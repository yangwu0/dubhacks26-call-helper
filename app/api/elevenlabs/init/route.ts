import { NextResponse } from "next/server";

// TODO: verify x-sift-secret with verifySecret(), create the calls row, return conversation_initiation_client_data.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "elevenlabs/init" },
    { status: 501 },
  );
}
