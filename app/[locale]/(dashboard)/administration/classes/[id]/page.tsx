import { AdminBackLink } from "@/components/admin/admin-back-link";
import { ClassAdminDetailForm } from "@/components/admin/class-admin-detail-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchClassAdminDetailForAdmin,
  fetchEligiblePrincipalsForClasses,
  formatAcademicYearRange,
} from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";

export default async function AdminClassDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }

  const [klass, principalOptions] = await Promise.all([
    fetchClassAdminDetailForAdmin(params.id),
    fetchEligiblePrincipalsForClasses(),
  ]);

  if (!klass) {
    notFound();
  }

  const tc = await getTranslations({
    locale: params.locale,
    namespace: "admin.classManage",
  });

  return (
    <div className="space-y-6">
      <AdminBackLink
        href="/administration/classes"
        label={tc("backToList")}
      />
      <div>
        <h1 className="text-3xl font-semibold">
          {tc("detailTitle", { name: klass.name })}
        </h1>
        {formatAcademicYearRange(
          klass.academicYearStart,
          klass.academicYearEnd,
        ) ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {tc("academicYearsCaption", {
              range: formatAcademicYearRange(
                klass.academicYearStart,
                klass.academicYearEnd,
              )!,
            })}
          </p>
        ) : null}
        {klass.principal ? (
          <p className="mt-1 text-muted-foreground">
            {tc("principalLabel")}: {klass.principal.firstName}{" "}
            {klass.principal.lastName}
          </p>
        ) : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{tc("formSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassAdminDetailForm
            locale={params.locale}
            initial={klass}
            principalOptions={principalOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
