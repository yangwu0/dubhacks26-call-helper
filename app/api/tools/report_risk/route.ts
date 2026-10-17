import { NextResponse } from "next/server";

// TODO: verify x-sift-secret with verifySecret(), then score and store risk.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "report_risk" },
    { status: 501 },
  );
}
