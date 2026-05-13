import type { SessionUser } from "@/types";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";

export function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40 dark:bg-muted/25 lg:flex-row">
      <AppSidebar user={user} />
      <div className="flex min-h-screen flex-1 flex-col lg:overflow-x-hidden">
        <DashboardHeader user={user} />
        <main className="flex-1 px-4 py-8 lg:px-10 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
