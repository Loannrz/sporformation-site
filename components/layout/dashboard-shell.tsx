import type { SessionUser } from "@/types";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardPageFrame } from "@/components/layout/dashboard-page-frame";
import { ForcedPasswordModal } from "@/components/auth/forced-password-modal";
import type { DisciplineDialogOptions } from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import { AdminSanctionsSessionToast } from "@/components/admin/admin-sanctions-session-toast";

export function DashboardShell({
  user,
  children,
  notificationCount = 0,
  sanctionsReminderCount = 0,
  disciplineOptions = null,
  locale,
}: {
  user: SessionUser;
  children: ReactNode;
  /** Badge messagerie dans la sidebar (optionnel). */
  notificationCount?: number;
  /** Badge hub sanctions / pastille avertissement (personnel administration). */
  sanctionsReminderCount?: number;
  disciplineOptions?: DisciplineDialogOptions | null;
  locale: AppLocale;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-muted/55 via-background to-muted/35 dark:from-muted/30 dark:via-background dark:to-muted/15 lg:flex-row">
      <ForcedPasswordModal mustSetPassword={user.mustSetPassword === true} />
      <AdminSanctionsSessionToast locale={locale} count={sanctionsReminderCount} />
      <AppSidebar
        user={user}
        notificationCount={notificationCount}
        sanctionsReminderCount={sanctionsReminderCount}
        disciplineOptions={disciplineOptions}
      />
      <div className="flex min-h-screen flex-1 flex-col lg:overflow-x-hidden">
        <DashboardHeader user={user} />
        <main className="relative flex-1 overflow-y-auto px-4 py-8 lg:px-10 lg:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/8 via-primary/[0.03] to-transparent dark:from-primary/12 dark:via-primary/[0.05]"
          />
          <div className="relative mx-auto w-full max-w-7xl">
            <DashboardPageFrame>{children}</DashboardPageFrame>
          </div>
        </main>
      </div>
    </div>
  );
}
