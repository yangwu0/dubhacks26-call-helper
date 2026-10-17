import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { SiftProvider } from "@/components/sift-provider";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SiftProvider>
      <DashboardShell>{children}</DashboardShell>
    </SiftProvider>
  );
}
