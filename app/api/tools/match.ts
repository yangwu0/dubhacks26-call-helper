export type NameMatch = {
  match: boolean;
  confidence: number;
  matchedAgainst: string | null;
};

const JARO_MATCH = 0.9;
const LEVENSHTEIN_MATCH = 0.84;

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(input: string): string[] {
  return normalizeName(input).split(" ").filter(Boolean);
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j++) {
      const cost = left[i] === right[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1,
        previous[j + 1] + 1,
        previous[j] + cost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function similarity(left: string, right: string): number {
  if (!left && !right) return 1;
  const distance = levenshtein(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function jaro(left: string, right: string): number {
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;
  const matchDistance = Math.max(
    0,
    Math.floor(Math.max(left.length, right.length) / 2) - 1,
  );
  const leftMatches = Array<boolean>(left.length).fill(false);
  const rightMatches = Array<boolean>(right.length).fill(false);
  let matches = 0;
  for (let i = 0; i < left.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, right.length);
    for (let j = start; j < end; j++) {
      if (rightMatches[j] || left[i] !== right[j]) continue;
      leftMatches[i] = true;
      rightMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < left.length; i++) {
    if (!leftMatches[i]) continue;
    while (!rightMatches[k]) k++;
    if (left[i] !== right[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  return (
    (matches / left.length +
      matches / right.length +
      (matches - transpositions) / matches) /
    3
  );
}

function jaroWinkler(left: string, right: string): number {
  const score = jaro(left, right);
  let prefix = 0;
  const limit = Math.min(4, left.length, right.length);
  while (prefix < limit && left[prefix] === right[prefix]) prefix++;
  return score + prefix * 0.1 * (1 - score);
}

function tokenScore(claimed: string, candidate: string): number {
  const claimedTokens = tokens(claimed).filter((token) => token.length >= 3);
  const candidateTokens = tokens(candidate).filter((token) => token.length >= 3);
  if (claimedTokens.length === 0 || candidateTokens.length === 0) return 0;
  const used = new Set<number>();
  const pairScores: number[] = [];
  for (const token of claimedTokens) {
    let best = 0;
    let bestIndex = -1;
    candidateTokens.forEach((other, index) => {
      if (used.has(index)) return;
      const score = Math.max(jaroWinkler(token, other), similarity(token, other));
      if (score > best) {
        best = score;
        bestIndex = index;
      }
    });
    if (best < 0.84 || bestIndex < 0) return 0;
    used.add(bestIndex);
    pairScores.push(best);
  }
  const average =
    pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length;
  return claimedTokens.length === 1 ? Math.min(average, 0.92) : average;
}

function scoreAgainst(claimed: string, candidate: string): number {
  const left = normalizeName(claimed);
  const right = normalizeName(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  return Math.max(
    tokenScore(left, right),
    jaroWinkler(left, right) >= JARO_MATCH ? jaroWinkler(left, right) : 0,
    similarity(left, right) >= LEVENSHTEIN_MATCH ? similarity(left, right) : 0,
  );
}

export function fuzzyMatchName(
  claimed: string,
  name: string,
  aliases: string[],
): NameMatch {
  const candidates = [name, ...aliases].filter((candidate) => candidate.trim());
  let best = 0;
  let matchedAgainst: string | null = null;
  for (const candidate of candidates) {
    const score = scoreAgainst(claimed, candidate);
    if (score > best) {
      best = score;
      matchedAgainst = candidate;
    }
  }
  const confidence = Math.round(best * 1000) / 1000;
  return {
    match: confidence >= LEVENSHTEIN_MATCH,
    confidence,
    matchedAgainst: confidence > 0 ? matchedAgainst : null,
  };
}
