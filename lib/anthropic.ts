import Anthropic from "@anthropic-ai/sdk";

export function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

// Stub. The post-call workspace replaces this with a real summary.
export async function summarize(transcript: string): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL;
  if (!model) {
    throw new Error("ANTHROPIC_MODEL is required");
  }
  throw new Error(
    `TODO: summarize ${transcript.length} characters with ${model} via client.messages.create`,
  );
}
