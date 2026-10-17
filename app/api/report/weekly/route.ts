import { NextResponse } from "next/server";

// TODO: return the weekly report JSON for the dashboard.
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented", todo: "report/weekly" },
    { status: 501 },
  );
}

// TODO: generate the weekly report and send it to the owner.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented", todo: "report/weekly" },
    { status: 501 },
  );
}
