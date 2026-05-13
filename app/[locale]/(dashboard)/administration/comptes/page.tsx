import { AdminBackLink } from "@/components/admin/admin-back-link";
import { CreateTeacherModal } from "@/components/admin/create-teacher-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchAllStaffForAdmin } from "@/lib/data/staff-admin";
import { getSessionUser } from "@/lib/session-server";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { Link } from "@/i18n/navigation";
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
          <p className="text-muted-foreground">{ta("listSubtitle")}</p>
        </div>
        <CreateTeacherModal
          locale={params.locale}
          viewerRole={user.role}
          classOptions={classOptions}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((s) => (
          <Link key={s.id} href={`/administration/comptes/${s.id}`}>
            <Card className="h-full border-border transition hover:border-primary/40">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
                <CardTitle>
                  {s.firstName} {s.lastName}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {s.mustSetPassword ? (
                    <Badge variant="secondary" className="font-normal">
                      {ta("badgePendingPassword")}
                    </Badge>
                  ) : null}
                  {!s.activeAtEstablishment ? (
                    <Badge
                      variant="outline"
                      className="text-amber-800 dark:text-amber-200"
                    >
                      {ta("badgeLeft")}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{s.email}</p>
                <p className="mt-2 font-medium text-foreground">{s.role}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
