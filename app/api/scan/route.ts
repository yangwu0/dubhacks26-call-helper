import { NextResponse } from "next/server";

// TODO: stretch. Scan a forwarded email, text, or bill and return a verdict.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "scan" },
    { status: 501 },
  );
}
