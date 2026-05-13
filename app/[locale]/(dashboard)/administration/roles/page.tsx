import { notFound } from "next/navigation";
import { OrgChartPlanner } from "@/components/admin/org-chart-planner";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CUSTOM_ROLES } from "@/lib/mock-data";
import { readSessionCookie } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminRolesPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await readSessionCookie();
  if (!user || user.role !== "DIRECTEUR") {
    notFound();
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const tOrg = await getTranslations({
    locale: params.locale,
    namespace: "org",
  });

  return (
    <div className="space-y-8">
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
          <OrgChartPlanner
            locale={params.locale}
            initialRoles={MOCK_CUSTOM_ROLES}
            labelFor={(role) =>
              params.locale === "fr" ? role.nameFr : role.nameEn
            }
          />
        </div>
      </Card>
    </div>
  );
}
