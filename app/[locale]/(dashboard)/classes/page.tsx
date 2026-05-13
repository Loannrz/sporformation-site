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
import { ChevronRight, Users } from "lucide-react";

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("subtitle", { count: classes.length })}
        </p>
      </div>
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
              <Card className="h-full border-border bg-card transition-colors group-hover:border-primary/40 group-hover:bg-muted/20">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-xl leading-snug">
                      {displayName}
                    </CardTitle>
                    <ChevronRight
                      className="mt-0.5 size-5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  </div>
                  {c.description ? (
                    <CardDescription className="line-clamp-2 text-xs">
                      {c.description}
                    </CardDescription>
                  ) : null}
                  <div className="space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        {t("principal")} ·{" "}
                      </span>
                      {c.principalDisplay ?? t("principalUnset")}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        {t("studentsCountShort", { count: c.studentIds.length })}
                      </span>
                      <span aria-hidden className="text-border">
                        |
                      </span>
                      <span>
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
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("emptyList")}
        </p>
      ) : null}
    </div>
  );
}
