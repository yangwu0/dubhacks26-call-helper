import { NextResponse } from "next/server";

// TODO: verify x-sift-secret with verifySecret(), then bridge the owner. WS1 owns the Twilio call.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "forward_call" },
    { status: 501 },
  );
}
