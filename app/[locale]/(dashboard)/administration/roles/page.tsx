import { AdminBackLink } from "@/components/admin/admin-back-link";
import { OrgChartPlanner } from "@/components/admin/org-chart-planner";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCustomRolesOrdered } from "@/lib/data/custom-roles";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminRolesPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const tOrg = await getTranslations({
    locale: params.locale,
    namespace: "org",
  });

  const roles = await fetchCustomRolesOrdered();

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={t("backToAdmin")} />
      <div>
        <h1 className="text-3xl font-semibold">{t("rolesTitle")}</h1>
        <p className="text-muted-foreground">{t("orgHint")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{tOrg("title")}</CardTitle>
          <CardDescription>{tOrg("assignPeople")}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-8">
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("rolesEmpty")}</p>
          ) : (
            <OrgChartPlanner
              locale={params.locale}
              initialRoles={roles}
              labelFor={(role) =>
                params.locale === "fr" ? role.nameFr : role.nameEn
              }
            />
          )}
        </div>
      </Card>
    </div>
  );
}
