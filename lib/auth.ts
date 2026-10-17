const SECRET_HEADER = "x-sift-secret";

export function verifySecret(req: Request): boolean {
  const expected = process.env.SIFT_WEBHOOK_SECRET;
  if (!expected) return false;
  return req.headers.get(SECRET_HEADER) === expected;
}
