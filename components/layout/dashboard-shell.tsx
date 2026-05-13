import type { SessionUser } from "@/types";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardPageFrame } from "@/components/layout/dashboard-page-frame";
import { ForcedPasswordModal } from "@/components/auth/forced-password-modal";
import type { DisciplineDialogOptions } from "@/lib/data/school";

export function DashboardShell({
  user,
  children,
  notificationCount = 0,
  disciplineOptions = null,
}: {
  user: SessionUser;
  children: ReactNode;
  /** Badge messagerie dans la sidebar (optionnel). */
  notificationCount?: number;
  disciplineOptions?: DisciplineDialogOptions | null;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/40 dark:bg-muted/25 lg:flex-row">
      <ForcedPasswordModal mustSetPassword={user.mustSetPassword === true} />
      <AppSidebar
        user={user}
        notificationCount={notificationCount}
        disciplineOptions={disciplineOptions}
      />
      <div className="flex min-h-screen flex-1 flex-col lg:overflow-x-hidden">
        <DashboardHeader user={user} />
        <main className="flex-1 overflow-y-auto px-4 py-8 lg:px-10 lg:py-12">
          <DashboardPageFrame>{children}</DashboardPageFrame>
        </main>
      </div>
    </div>
  );
}
