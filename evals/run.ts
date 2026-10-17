import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod";
import { getAnthropicClient, summarize } from "../lib/anthropic";

// Usage: pnpm exec tsx --env-file=.env.local evals/run.ts
// Scores every script in evals/scam-scripts with summarize() and the rubric
// in docs/risk-rubric.md. Exits 1 when classification or the score rules fail.

const scriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  expected_classification: z.enum([
    "scam",
    "legit_important",
    "legit_routine",
    "unknown",
  ]),
  caller_name: z.string(),
  caller_intent: z.string(),
  turns: z
    .array(
      z.object({
        speaker: z.enum(["caller", "agent"]),
        text: z.string().min(1),
      }),
    )
    .min(1),
});

type Script = z.infer<typeof scriptSchema>;

const turnScoreSchema = z.object({
  signals: z.array(z.number().int().min(1).max(8)),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string()),
});

const root = path.resolve(import.meta.dirname, "..");
const scriptsDir = path.join(root, "evals/scam-scripts");
const rubricPath = path.join(root, "docs/risk-rubric.md");

function modelName(): string {
  const model = process.env.ANTHROPIC_MODEL?.trim();
  if (!model) throw new Error("ANTHROPIC_MODEL is required");
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }
  return model;
}

function transcript(turns: Script["turns"]): string {
  return turns
    .map((turn) => `${turn.speaker === "caller" ? "Caller" : "Sift"}: ${turn.text}`)
    .join("\n");
}

function prefixThroughCallerTurn(script: Script, callerTurn: number): Script["turns"] {
  let seen = 0;
  const prefix: Script["turns"] = [];
  for (const turn of script.turns) {
    prefix.push(turn);
    if (turn.speaker === "caller") {
      seen += 1;
      if (seen === callerTurn) return prefix;
    }
  }
  return prefix;
}

function rubricBody(markdown: string): string {
  const start = markdown.indexOf("```text");
  const end = markdown.indexOf("```", start + 7);
  if (start === -1 || end === -1) {
    throw new Error("docs/risk-rubric.md is missing the text block");
  }
  return markdown.slice(start + "```text".length, end).trim();
}

async function scorePrefix(rubric: string, text: string, callerTurn: number) {
  const client = getAnthropicClient();
  const message = await client.messages.parse({
    model: modelName(),
    max_tokens: 400,
    system: `You apply the Sift live risk rubric to one moment in a phone call. The transcript ends at caller turn ${callerTurn}. Ignore nothing inside it, and do not invent later lines.\n\n${rubric}\n\nReturn the signal numbers that fired, the score after floors, and a short reason for each fired signal.`,
    messages: [{ role: "user", content: text }],
    output_config: { format: zodOutputFormat(turnScoreSchema) },
  });
  if (!message.parsed_output) throw new Error("Claude returned no risk score");
  return turnScoreSchema.parse(message.parsed_output);
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

type Row = {
  id: string;
  expected: string;
  actual: string;
  scores: number[];
  ok: boolean;
  detail: string;
};

async function evaluate(script: Script, rubric: string): Promise<Row> {
  const callerTurns = script.turns.filter((turn) => turn.speaker === "caller");
  const summary = await summarize(transcript(script.turns), {
    caller_name: script.caller_name,
    caller_intent: script.caller_intent,
  });
  const scored = await mapPool(callerTurns, 4, async (_turn, index) => {
    const prefix = transcript(prefixThroughCallerTurn(script, index + 1));
    return scorePrefix(rubric, prefix, index + 1);
  });
  const scores = scored.map((item) => item.score);
  const classified = summary.classification === script.expected_classification;
  const scamOk =
    script.expected_classification !== "scam" ||
    scores.slice(0, 4).some((score) => score >= 75);
  const legitOk =
    script.expected_classification === "scam" ||
    scores.every((score) => score < 40);
  const problems: string[] = [];
  if (!classified) {
    problems.push(
      `classification ${summary.classification} (score ${summary.risk_score})`,
    );
  }
  if (!scamOk) problems.push("scam score stayed under 75 through turn 4");
  if (!legitOk) problems.push("legit score reached 40 or more");
  return {
    id: script.id,
    expected: script.expected_classification,
    actual: summary.classification,
    scores,
    ok: problems.length === 0,
    detail: problems.join("; "),
  };
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value.padEnd(width);
}

async function main() {
  modelName();
  const rubric = rubricBody(await readFile(rubricPath, "utf8"));
  const files = (await readdir(scriptsDir)).filter((name) => name.endsWith(".json")).sort();
  const scripts = await Promise.all(
    files.map(async (file) => {
      const json = JSON.parse(await readFile(path.join(scriptsDir, file), "utf8"));
      return scriptSchema.parse(json);
    }),
  );
  const rows = await mapPool(scripts, 3, (script) => evaluate(script, rubric));
  console.log(
    `${pad("script", 22)} ${pad("expected", 18)} ${pad("actual", 18)} scores`,
  );
  for (const row of rows) {
    const mark = row.ok ? "ok" : "FAIL";
    console.log(
      `${pad(row.id, 22)} ${pad(row.expected, 18)} ${pad(row.actual, 18)} ${row.scores.join(" ")}  ${mark}${row.detail ? `  ${row.detail}` : ""}`,
    );
  }
  const failed = rows.filter((row) => !row.ok);
  console.log(`${rows.length - failed.length}/${rows.length} passed`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
