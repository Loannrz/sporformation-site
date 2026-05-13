import { Link } from "@/i18n/navigation";
import { AnnouncementLogoMark } from "@/components/announcements/announcement-logo-mark";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchAnnouncementsForUser,
  fetchClassesWithStudents,
  fetchDashboardDirectorStats,
  fetchRecentSanctionsForUser,
} from "@/lib/data/school";
import { hasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { format } from "date-fns";
import { fr as frLocale, enUS } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { announcementAccentArticleClass } from "@/lib/announcement-accents";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "dashboard",
  });
  const tAnnounce = await getTranslations({
    locale: params.locale,
    namespace: "announcements",
  });
  const locale = params.locale;
  const dateLocale = locale === "fr" ? frLocale : enUS;

  if (!user) {
    return null;
  }

  const directorExtras = hasPermission(user, "VIEW_DIRECTOR_DASHBOARD");
  const emptyDirectorStats = {
    teacherStaffCount: 0,
    studentCount: 0,
    activeClassCount: 0,
    fileCount: 0,
  };

  const [announcements, sanctionsPreview, directorStats, classesIndex] =
    await Promise.all([
      fetchAnnouncementsForUser(user),
      fetchRecentSanctionsForUser(user, 4),
      directorExtras
        ? fetchDashboardDirectorStats()
        : Promise.resolve(emptyDirectorStats),
      fetchClassesWithStudents(),
    ]);

  const classNameById = new Map(classesIndex.map((c) => [c.id, c.name]));

  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.importance === b.importance) {
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return a.importance === "urgent" ? -1 : 1;
  });

  const classScope =
    user.role === "PROF_PRINCIPAL" ? user.principalClassIds ?? [] : [];

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("welcome", { name: user.firstName })}
        </h1>
        <p className="text-muted-foreground">
          {directorExtras
            ? t("subtitleDirector")
            : user.role === "PROF_PRINCIPAL"
              ? t("subtitlePrincipal")
              : t("subtitleTeacher")}
        </p>
      </header>

      {directorExtras && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("statsTeachers")}
            hint={t("statsTeachersHint")}
            value={`${directorStats.teacherStaffCount}`}
          />
          <StatCard
            label={t("statsStudents")}
            value={`${directorStats.studentCount}`}
          />
          <StatCard
            label={t("statsClasses")}
            value={`${directorStats.activeClassCount}`}
          />
          <StatCard
            label={t("statsFiles")}
            value={`${directorStats.fileCount}`}
          />
        </section>
      )}

      {!directorExtras && user.role === "PROF_PRINCIPAL" && (
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5 shadow-none">
            <CardHeader>
              <CardTitle>{t("myClasses")}</CardTitle>
              <CardDescription>
                {classScope.length
                  ? classScope.join(", ")
                  : t("quickStudents")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {classScope.map((cid) => (
                <Link key={cid} href={`/classes/${cid}`}>
                  <Badge variant="outline" className="cursor-pointer px-3 py-1">
                    {classNameById.get(cid) ?? cid}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("recentSanctions")}</CardTitle>
              <CardDescription>SPORFORMATION discipline</CardDescription>
            </div>
            <Badge variant="accent">Live</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {sanctionsPreview.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{s.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(s.date), "PPp", { locale: dateLocale })}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {s.description}
                  </p>
                </div>
                <Badge
                  variant={s.status === "active" ? "default" : "secondary"}
                >
                  {s.status}
                </Badge>
              </div>
            ))}
            {sanctionsPreview.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune sanction récente.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-primary/25 dark:border-primary/15">
          <CardHeader>
            <CardTitle>{tAnnounce("title")}</CardTitle>
            <CardDescription className="space-y-1">
              <span className="block">{tAnnounce("subtitle")}</span>
              {hasPermission(user, "CREATE_ANNOUNCEMENTS") ? (
                <Link
                  href="/admin/announcements"
                  className="inline-block text-xs font-medium text-primary underline underline-offset-2"
                >
                  {tAnnounce("composerLink")}
                </Link>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {sortedAnnouncements.map((a) => (
              <article
                key={a.id}
                className={cn(
                  "flex gap-3 rounded-xl border p-4 backdrop-blur-sm transition",
                  announcementAccentArticleClass(a.accentKey),
                )}
              >
                <AnnouncementLogoMark
                  logoKey={a.logoKey}
                  accentKey={a.accentKey}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        a.importance === "urgent" ? "urgent" : "secondary"
                      }
                    >
                      {a.importance}
                    </Badge>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {format(new Date(a.createdAt), "d MMM yyyy", {
                        locale: dateLocale,
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{a.title}</p>
                  <div
                    className="prose prose-sm mt-2 max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: a.html }}
                  />
                </div>
              </article>
            ))}
            {sortedAnnouncements.length === 0 && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{tAnnounce("empty")}</p>
                <p className="text-xs">{tAnnounce("emptyHint")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="border-none bg-gradient-to-br from-card to-muted/40 shadow-soft dark:shadow-soft-dark">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        {hint ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
        ) : null}
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
