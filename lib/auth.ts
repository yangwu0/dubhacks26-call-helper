const SECRET_HEADER = "x-sift-secret";

export function verifySecret(req: Request): boolean {
  const expected = process.env.SIFT_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  if (req.headers.get(SECRET_HEADER) === expected) return true;
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ") && auth.slice(7).trim() === expected) {
    return true;
  }
  return false;
}

/** Reject only when a secret was sent and it is wrong. Missing auth is allowed. */
export function rejectIfBadSecret(req: Request): Response | null {
  const expected = process.env.SIFT_WEBHOOK_SECRET?.trim();
  if (!expected) return null;
  const providedHeader = req.headers.get(SECRET_HEADER);
  const auth = req.headers.get("authorization");
  const sentSomething = providedHeader !== null || Boolean(auth?.trim());
  if (!sentSomething) return null;
  if (verifySecret(req)) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
