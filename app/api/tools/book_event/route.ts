import { NextResponse } from "next/server";

// TODO: verify x-sift-secret with verifySecret(), then insert a calendar event.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "book_event" },
    { status: 501 },
  );
}
