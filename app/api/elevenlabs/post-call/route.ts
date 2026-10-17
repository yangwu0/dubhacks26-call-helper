import { NextResponse } from "next/server";

// TODO: verify the ElevenLabs signature, summarize with Claude, update the call, message the owner.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "elevenlabs/post-call" },
    { status: 501 },
  );
}
