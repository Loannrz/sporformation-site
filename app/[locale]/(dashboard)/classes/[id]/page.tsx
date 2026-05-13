import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  countActiveSanctionsForStudents,
  fetchClassById,
  fetchProfileById,
  fetchSanctionsForClassStudents,
  fetchStudentsForClass,
  formatCloudClassDisplayName,
} from "@/lib/data/school";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Users } from "lucide-react";

export default async function ClassDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const cls = await fetchClassById(params.id);
  if (!cls) {
    notFound();
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "classes",
  });
  const dateFnsLocale = params.locale === "fr" ? fr : enUS;

  const principal = cls.principalId
    ? await fetchProfileById(cls.principalId)
    : null;

  const students = await fetchStudentsForClass(cls.id);
  const studentIds = students.map((s) => s.id);
  const [classSanctions, activeSanctionCount] = await Promise.all([
    fetchSanctionsForClassStudents(studentIds, 24),
    countActiveSanctionsForStudents(studentIds),
  ]);

  const displayTitle = formatCloudClassDisplayName(
    cls.name,
    cls.academicYearStart ?? null,
    cls.academicYearEnd ?? null,
  );

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/classes" className="hover:text-primary">
            ← {t("title")}
          </Link>
        </p>
        <div className="mt-4 space-y-3">
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            {displayTitle}
          </h1>
          {cls.description ? (
            <p className="max-w-prose text-sm text-muted-foreground">
              {cls.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("principal")} :</span>
            <Badge variant="secondary">
              {principal
                ? `${principal.firstName} ${principal.lastName}`
                : t("principalUnset")}
            </Badge>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="size-4 opacity-70" aria-hidden />
              {t("summaryStudents")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">
              {students.length}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("studentsCountShort", { count: students.length })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {t("summarySanctions")}
            </CardTitle>
            <CardDescription>{t("summarySanctionsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight">
              {activeSanctionCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("activeSanctionsShort", { count: activeSanctionCount })}
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("students")}</CardTitle>
            <CardDescription>{t("studentsListHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground md:col-span-2">
                {t("noStudents")}
              </p>
            ) : (
              students.map((s) => (
                <Link
                  href={`/etudiants/${s.id}`}
                  key={s.id}
                  className="rounded-xl border border-border bg-muted/40 p-4 transition hover:border-primary/40 hover:bg-muted/60"
                >
                  <p className="font-medium">
                    {s.firstName} {s.lastName}
                  </p>
                  {s.email ? (
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("files")}</CardTitle>
            <CardDescription>{t("filesBlurb")}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              classes/{cls.id}
            </code>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sanctions")}</CardTitle>
          <CardDescription>{t("sanctionsFeedDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {classSanctions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("sanctionsPreviewEmpty")}</p>
          ) : (
            classSanctions.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-border/80 px-4 py-3 text-sm"
              >
                <p className="font-semibold capitalize">{s.type}</p>
                <p className="text-muted-foreground">
                  {format(new Date(s.date), "PP · HH:mm", {
                    locale: dateFnsLocale,
                  })}
                </p>
                <p className="mt-2 text-muted-foreground">{s.description}</p>
                <Badge className="mt-2 capitalize" variant="outline">
                  {s.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
