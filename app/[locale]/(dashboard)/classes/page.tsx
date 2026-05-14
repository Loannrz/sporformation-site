import { Link } from "@/i18n/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchStaffClassesOverview,
  formatCloudClassDisplayName,
} from "@/lib/data/school";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Layers,
  School,
} from "lucide-react";

export default async function ClassesPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const classes = await fetchStaffClassesOverview();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "classes",
  });

  return (
    <div className="space-y-8 pb-8">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 pb-10 shadow-soft gradient-mesh dark:gradient-mesh-dark">
        <div className="relative space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
            {t("heroEyebrow")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="max-w-2xl text-muted-foreground">{t("heroLead")}</p>
          <p className="text-sm text-foreground/90">
            {t("subtitle", { count: classes.length })}
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((c) => {
          const displayName = formatCloudClassDisplayName(
            c.name,
            c.academicYearStart ?? null,
            c.academicYearEnd ?? null,
          );
          return (
            <Link
              key={c.id}
              href={`/classes/${c.id}`}
              className="group block outline-none ring-offset-background focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("cardOpenAria", { name: displayName })}
            >
              <Card className="relative h-full overflow-hidden border-border bg-card transition-[border-color,box-shadow] hover:border-primary/20 hover:shadow-soft dark:hover:shadow-soft-dark">
                <div
                  className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/90 to-accent/80"
                  aria-hidden
                />
                <CardHeader className="relative space-y-3 pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <Layers className="size-5" />
                      </div>
                      <CardTitle className="text-xl font-semibold leading-snug transition-colors group-hover:text-primary">
                        {displayName}
                      </CardTitle>
                    </div>
                    <ChevronRight
                      className="mt-1 size-5 shrink-0 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </div>
                  {c.description ? (
                    <CardDescription className="line-clamp-2 pl-[3.25rem] text-sm leading-snug">
                      {c.description}
                    </CardDescription>
                  ) : null}
                  <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                    <p className="flex items-start gap-2">
                      <GraduationCap
                        className="mt-0.5 size-4 shrink-0 text-primary/80"
                        aria-hidden
                      />
                      <span>
                        <span className="font-medium text-foreground">
                          {t("principalShort")}
                        </span>{" "}
                        {c.principalDisplay ?? t("principalUnset")}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 pl-6 text-xs sm:text-sm">
                      <span className="inline-flex items-center gap-1.5 text-foreground/85">
                        <School
                          className="size-3.5 text-primary/70"
                          aria-hidden
                        />
                        {t("studentsCountShort", {
                          count: c.studentIds.length,
                        })}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-foreground/85">
                        <ClipboardList
                          className="size-3.5 text-accent/85"
                          aria-hidden
                        />
                        {t("activeSanctionsShort", {
                          count: c.activeSanctionsCount,
                        })}
                      </span>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-6 py-14 text-center">
          <p className="text-base font-medium text-foreground">{t("emptyTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("emptyList")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
