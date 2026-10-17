import { NextResponse } from "next/server";

// TODO: verify x-sift-secret with verifySecret(), then store the message and text the owner.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "take_message" },
    { status: 501 },
  );
}
