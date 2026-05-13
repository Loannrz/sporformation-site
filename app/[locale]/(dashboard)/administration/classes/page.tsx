import { AdminBackLink } from "@/components/admin/admin-back-link";
import { CreateClassModal } from "@/components/admin/create-class-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchClassesWithStudentsForAdmin,
  formatAcademicYearRange,
} from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminClassesPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }

  const classes = await fetchClassesWithStudentsForAdmin();

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const tc = await getTranslations({
    locale: params.locale,
    namespace: "admin.classManage",
  });

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin" label={t("backToAdmin")} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("classesTitle")}</h1>
          <p className="max-w-2xl text-muted-foreground">{tc("listSubtitle")}</p>
        </div>
        <CreateClassModal locale={params.locale} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {classes.map((c) => {
          const yearLine = formatAcademicYearRange(
            c.academicYearStart,
            c.academicYearEnd,
          );
          return (
          <Link key={c.id} href={`/administration/classes/${c.id}`}>
            <Card className="h-full border-border transition hover:border-primary/40">
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
                <CardDescription className="space-y-1">
                  {yearLine ? (
                    <span className="block font-medium text-foreground/90">
                      {yearLine}
                    </span>
                  ) : null}
                  {c.description ? (
                    <span className="line-clamp-2 block">{c.description}</span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{tc("studentCount", { count: c.studentIds.length })}</p>
                <p className="mt-2 text-primary">{tc("openClass")} →</p>
              </CardContent>
            </Card>
          </Link>
          );
        })}
      </div>
      {classes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tc("emptyList")}</p>
      ) : null}
    </div>
  );
}
