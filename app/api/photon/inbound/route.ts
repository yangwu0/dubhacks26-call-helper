import { NextResponse } from "next/server";

// TODO(photon): WS3 handles iMessage commands (CALL, BLOCK, ADD, REPORT). SMS fallback lands here too.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "photon/inbound" },
    { status: 501 },
  );
}
