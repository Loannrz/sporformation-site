import { AdminBackLink } from "@/components/admin/admin-back-link";
import { CreateTeacherModal } from "@/components/admin/create-teacher-modal";
import { StaffAccountsSearchGrid } from "@/components/admin/staff-accounts-search-grid";
import { fetchAdminClassOptions } from "@/lib/data/school";
import {
  fetchAllStaffForAdmin,
  fetchPendingTeacherInvitesForAdmin,
} from "@/lib/data/staff-admin";
import { getSessionUser } from "@/lib/session-server";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminAccountsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const ta = await getTranslations({
    locale: params.locale,
    namespace: "admin.accounts",
  });

  const [staffList, pendingRaw, classOptions] = await Promise.all([
    fetchAllStaffForAdmin(),
    fetchPendingTeacherInvitesForAdmin(),
    fetchAdminClassOptions(),
  ]);
  const visible = isDirector(user)
    ? staffList
    : staffList.filter(
        (s) => s.role === "PROFESSEUR" || s.role === "PROF_PRINCIPAL",
      );
  const pendingInvites = isDirector(user)
    ? pendingRaw
    : pendingRaw.filter(
        (p) => p.role === "PROFESSEUR" || p.role === "PROF_PRINCIPAL",
      );
  const totalProfiles = visible.length + pendingInvites.length;

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={t("backToAdmin")} />

      <div className="overflow-hidden rounded-3xl border border-border/75 bg-card shadow-md ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <div
          aria-hidden
          className="h-1.5 bg-gradient-to-r from-primary/85 via-primary/65 to-accent/70"
        />
        <div className="space-y-5 bg-gradient-to-b from-muted/35 via-background to-background p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                {t("accountsTitle")}
              </h1>
              <p className="max-w-prose text-muted-foreground">{ta("listSubtitle")}</p>
            </div>
            <CreateTeacherModal
              locale={params.locale}
              viewerRole={user.role}
              classOptions={classOptions}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background/90 px-2.5 py-1 font-medium">
              {totalProfiles}
            </span>
            <span>{t("accountsTitle")}</span>
            {pendingInvites.length > 0 ? (
              <>
                <span className="text-border">•</span>
                <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-900 dark:text-amber-100">
                  {pendingInvites.length}
                </span>
                <span>{ta("inviteNeverLoggedIn")}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <StaffAccountsSearchGrid
        staff={visible}
        pendingInvites={pendingInvites}
        locale={params.locale}
        viewerId={user.id}
        viewerRole={user.role}
        classOptions={classOptions}
      />
    </div>
  );
}
