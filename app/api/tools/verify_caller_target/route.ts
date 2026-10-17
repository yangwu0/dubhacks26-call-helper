import { NextResponse } from "next/server";

// TODO: verify x-sift-secret with verifySecret(), then fuzzy-match claimed_target.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "verify_caller_target" },
    { status: 501 },
  );
}
