"use client";

import { CallLog } from "@/components/call-log";
import { DashboardShell } from "@/components/dashboard-shell";
import { SiftProvider } from "@/components/sift-provider";

export default function HomePage() {
  return (
    <SiftProvider>
      <DashboardShell>
        <CallLog />
      </DashboardShell>
    </SiftProvider>
  );
}
