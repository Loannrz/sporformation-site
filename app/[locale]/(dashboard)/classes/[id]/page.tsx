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
import { Button } from "@/components/ui/button";
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
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Cloud,
  Layers,
  UserCircle2,
  UserRound,
} from "lucide-react";

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
    <div className="space-y-10 pb-8">
      <div className="space-y-6">
        <p className="text-sm">
          <Link
            href="/classes"
            className="inline-flex items-center gap-2 rounded-lg font-medium text-muted-foreground transition hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("detailBack")}
          </Link>
        </p>

        <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft gradient-mesh dark:gradient-mesh-dark sm:p-8 dark:shadow-soft-dark">
          <div className="relative flex flex-wrap items-start gap-3">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden
            >
              <Layers className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/90">
                {t("detailHeaderTag")}
              </p>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl md:leading-tight">
                  {displayTitle}
                </h1>
                <span
                  className="block h-1 w-20 rounded-full bg-gradient-to-r from-primary/90 to-accent/90"
                  aria-hidden
                />
              </div>
            </div>
          </div>
          {cls.description ? (
            <p className="relative mt-4 max-w-prose text-sm text-muted-foreground">
              {cls.description}
            </p>
          ) : null}
          <div className="relative mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-6">
            <span className="text-sm text-muted-foreground">{t("principalShort")}</span>
            <Badge
              variant="secondary"
              className="border border-primary/15 bg-primary/[0.06] font-normal text-foreground dark:border-primary/25 dark:bg-primary/10"
            >
              {principal
                ? `${principal.firstName} ${principal.lastName}`
                : t("principalUnset")}
            </Badge>
          </div>
        </header>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="overflow-hidden border-l-[3px] border-l-primary/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserCircle2
                className="size-5 text-primary/85"
                aria-hidden
              />
              {t("summaryStudents")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {students.length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("studentsCountShort", { count: students.length })}
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-l-[3px] border-l-accent/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardList
                className="size-5 text-accent/90"
                aria-hidden
              />
              {t("summarySanctions")}
            </CardTitle>
            <CardDescription>{t("summarySanctionsHintShort")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {activeSanctionCount}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("activeSanctionsShort", { count: activeSanctionCount })}
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">{t("students")}</CardTitle>
            <CardDescription>{t("studentsListHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {students.length === 0 ? (
              <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
                {t("noStudents")}
              </div>
            ) : (
              students.map((s) => (
                <Link
                  href={`/etudiants/${s.id}`}
                  key={s.id}
                  className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/25 hover:bg-muted/35"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                      aria-hidden
                    >
                      <UserRound className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight transition-colors group-hover:text-primary">
                        {s.firstName} {s.lastName}
                      </p>
                      {s.email ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {s.email}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">—</p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        {t("openStudentProfile")}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="border-border bg-muted/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cloud
                className="size-5 shrink-0 text-primary/80"
                aria-hidden
              />
              {t("files")}
            </CardTitle>
            <CardDescription>{t("filesBlurbShort")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{t("filesExplain")}</p>
            <Button className="h-11 font-semibold" size="lg" asChild>
              <Link
                href={`/cloud/${encodeURIComponent(`classe-${cls.id}`)}`}
                className="inline-flex items-center gap-2"
              >
                <BookOpen className="size-4" />
                {t("filesCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("sanctions")}</CardTitle>
          <CardDescription>{t("sanctionsFeedDescShort")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {classSanctions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
              {t("sanctionsPreviewEmpty")}
            </p>
          ) : (
            classSanctions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border border-l-[3px] border-l-accent/45 bg-card px-4 py-4 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold capitalize">{s.type}</p>
                  <Badge variant="outline" className="capitalize">
                    {s.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(s.date), "PP · HH:mm", {
                    locale: dateFnsLocale,
                  })}
                </p>
                <p className="mt-2 text-muted-foreground">{s.description}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
