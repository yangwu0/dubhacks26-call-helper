import { NextResponse } from "next/server";

// TODO: verify x-sift-secret with verifySecret(), then return free slots only.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "check_availability" },
    { status: 501 },
  );
}
