import { AdminBackLink } from "@/components/admin/admin-back-link";
import { CreateTeacherModal } from "@/components/admin/create-teacher-modal";
import { StaffAccountsSearchGrid } from "@/components/admin/staff-accounts-search-grid";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchAllStaffForAdmin } from "@/lib/data/staff-admin";
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

  const [staffList, classOptions] = await Promise.all([
    fetchAllStaffForAdmin(),
    fetchAdminClassOptions(),
  ]);
  const visible = isDirector(user)
    ? staffList
    : staffList.filter(
        (s) => s.role === "PROFESSEUR" || s.role === "PROF_PRINCIPAL",
      );

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin" label={t("backToAdmin")} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("accountsTitle")}</h1>
          <p className="max-w-prose text-muted-foreground">{ta("listSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreateTeacherModal
            locale={params.locale}
            viewerRole={user.role}
            classOptions={classOptions}
          />
        </div>
      </div>
      <StaffAccountsSearchGrid
        staff={visible}
        locale={params.locale}
        viewerId={user.id}
        viewerRole={user.role}
        classOptions={classOptions}
      />
    </div>
  );
}
