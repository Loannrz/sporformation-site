import { Link } from "@/i18n/navigation";
import { AnnouncementLogoMark } from "@/components/announcements/announcement-logo-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { announcementAccentArticleClass } from "@/lib/announcement-accents";
import { teacherCloudScopedClassIds } from "@/lib/cloud-teacher-scope";
import type { MessagingConversationListItem } from "@/lib/data/messaging";
import type { DashboardDirectorStats } from "@/lib/data/school";
import { formatCloudClassDisplayName } from "@/lib/format-cloud-class-display-name";
import { hasPermission } from "@/lib/permissions";
import { isStaffAdmin } from "@/lib/roles";
import { sanctionTypeLabel } from "@/lib/sanction-labels";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/routing";
import type { Announcement, Sanction, SchoolClass, SessionUser } from "@/types";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { enUS, fr as frLocale } from "date-fns/locale";
import {
  CalendarDays,
  Cloud,
  Megaphone,
  MessageSquare,
  Shield,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

function subtitleKeyForRole(role: SessionUser["role"]): string {
  switch (role) {
    case "DIRECTEUR":
      return "subtitleDirector";
    case "ADMINISTRATEUR":
      return "subtitleAdministrator";
    case "PROF_PRINCIPAL":
      return "subtitlePrincipal";
    case "PROFESSEUR":
      return "subtitleTeacher";
    case "ELEVE":
      return "subtitleStudent";
    default:
      return "subtitleTeacher";
  }
}

function classDisplayLabel(c: SchoolClass): string {
  return formatCloudClassDisplayName(
    c.name,
    c.academicYearStart ?? null,
    c.academicYearEnd ?? null,
  );
}

function sortClassIds(ids: string[], byId: Map<string, SchoolClass>): string[] {
  return [...ids].sort((a, b) => {
    const ca = byId.get(a);
    const cb = byId.get(b);
    const la = ca ? classDisplayLabel(ca) : a;
    const lb = cb ? classDisplayLabel(cb) : b;
    return la.localeCompare(lb, "fr", { sensitivity: "base" });
  });
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

function ClassBadgeRow({
  classIds,
  classById,
}: {
  classIds: string[];
  classById: Map<string, SchoolClass>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {classIds.map((cid) => {
        const c = classById.get(cid);
        const label = c ? classDisplayLabel(c) : cid;
        return (
          <Link key={cid} href={`/classes/${cid}`}>
            <Badge variant="outline" className="cursor-pointer px-3 py-1">
              {label}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

export async function DashboardHome({
  locale,
  user,
  announcements,
  sanctionsPreview,
  sanctionStudentNames,
  directorStats,
  classesIndex,
  messagingPreview,
  unreadTotal,
  studentClass,
}: {
  locale: AppLocale;
  user: SessionUser;
  announcements: Announcement[];
  sanctionsPreview: Sanction[];
  sanctionStudentNames: Record<string, string>;
  directorStats: DashboardDirectorStats | null;
  classesIndex: SchoolClass[];
  messagingPreview: MessagingConversationListItem[];
  unreadTotal: number;
  studentClass: SchoolClass | null;
}) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tAnnounce = await getTranslations({ locale, namespace: "announcements" });
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const dateLocale = locale === "fr" ? frLocale : enUS;
  const localeShort = locale === "fr" ? "fr" : "en";

  const classById = new Map(classesIndex.map((c) => [c.id, c]));

  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.importance === b.importance) {
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return a.importance === "urgent" ? -1 : 1;
  });

  const showEstablishmentStats = Boolean(directorStats);

  const canMessage = hasPermission(user, "SEND_MESSAGES");
  const canSanctions = hasPermission(user, "VIEW_SANCTIONS");
  const canCalendar = hasPermission(user, "VIEW_CALENDAR");
  const canCloud =
    hasPermission(user, "UPLOAD_FILES") ||
    hasPermission(user, "ACCESS_STUDENT_CLOUD");

  const principalIdsRaw =
    user.role === "PROF_PRINCIPAL" ? (user.principalClassIds ?? []) : [];
  const principalSet = new Set(principalIdsRaw);
  const assignedAsidePrincipal =
    user.role === "PROF_PRINCIPAL"
      ? (user.assignedClassIds ?? []).filter((id) => !principalSet.has(id))
      : [];

  const principalIdsSorted = sortClassIds(principalIdsRaw, classById);
  const assignedAsideSorted = sortClassIds(assignedAsidePrincipal, classById);

  const scopedForTeacher = teacherCloudScopedClassIds(user);
  const professorScopedSorted =
    user.role === "PROFESSEUR" && scopedForTeacher != null
      ? sortClassIds(scopedForTeacher, classById)
      : [];

  const studentCloudHref =
    user.role === "ELEVE" && user.studentClassId
      ? `/cloud/classe-${user.studentClassId}`
      : "/cloud";

  const cloudHref =
    user.role === "ELEVE" ? studentCloudHref : "/cloud";

  const quickLinks: {
    href: string;
    label: string;
    icon: typeof Cloud;
  }[] = [];

  if (canCloud) {
    quickLinks.push({ href: cloudHref, label: tNav("cloud"), icon: Cloud });
  }
  if (canMessage) {
    quickLinks.push({
      href: "/messagerie",
      label: tNav("messaging"),
      icon: MessageSquare,
    });
  }
  quickLinks.push({
    href: "/annonces",
    label: tNav("announcements"),
    icon: Megaphone,
  });
  if (canCalendar) {
    quickLinks.push({
      href: "/calendrier",
      label: tNav("calendar"),
      icon: CalendarDays,
    });
  }
  if (user.role !== "ELEVE") {
    quickLinks.push({
      href: "/classes",
      label: tNav("classes"),
      icon: Users,
    });
  }
  if (isStaffAdmin(user)) {
    quickLinks.push({
      href: "/admin",
      label: tNav("admin"),
      icon: Shield,
    });
  }

  const announcementsShown = sortedAnnouncements.slice(0, 8);

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-primary/[0.07] via-card to-muted/30 p-6 shadow-soft dark:shadow-soft-dark md:p-8">
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t("welcome", { name: user.firstName })}
            </h1>
            <p className="max-w-xl text-muted-foreground">
              {t(subtitleKeyForRole(user.role))}
            </p>
          </header>
          {canMessage && unreadTotal > 0 ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant="default" className="px-3 py-1 text-xs font-semibold">
                {t("messagingUnreadSummary", { count: unreadTotal })}
              </Badge>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/messagerie">{t("messagingOpen")}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {showEstablishmentStats && directorStats ? (
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
      ) : null}

      {user.role === "PROF_PRINCIPAL" ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5 shadow-none">
            <CardHeader>
              <CardTitle>{t("principalClassesTitle")}</CardTitle>
              <CardDescription>{t("principalClassesHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              {principalIdsSorted.length > 0 ? (
                <ClassBadgeRow
                  classIds={principalIdsSorted}
                  classById={classById}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("principalClassesEmpty")}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{t("otherTeachingClassesTitle")}</CardTitle>
              <CardDescription>{t("otherTeachingClassesHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              {assignedAsideSorted.length > 0 ? (
                <ClassBadgeRow
                  classIds={assignedAsideSorted}
                  classById={classById}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("otherTeachingClassesEmpty")}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {user.role === "PROFESSEUR" ? (
        <section>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{t("teacherScopedClassesTitle")}</CardTitle>
              <CardDescription>{t("teacherScopedClassesHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              {professorScopedSorted.length > 0 ? (
                <ClassBadgeRow
                  classIds={professorScopedSorted}
                  classById={classById}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("teacherScopedClassesEmpty")}
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {user.role === "ELEVE" ? (
        <section>
          <Card className="border-muted shadow-none">
            <CardHeader>
              <CardTitle>{t("studentClassTitle")}</CardTitle>
              <CardDescription>
                {studentClass
                  ? classDisplayLabel(studentClass)
                  : t("studentNoClassAssignHint")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {user.studentClassId ? (
                <Button asChild>
                  <Link href={studentCloudHref}>{t("studentClassCloudCta")}</Link>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link href="/annonces">{tNav("announcements")}</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {quickLinks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("quickLinksTitle")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Button key={href + label} variant="outline" size="sm" asChild>
                <Link href={href} className="gap-2">
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {label}
                </Link>
              </Button>
            ))}
            {hasPermission(user, "CREATE_ANNOUNCEMENTS") ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/announcements" className="gap-2">
                  <Megaphone className="h-4 w-4 shrink-0 opacity-80" />
                  {t("createAnnouncement")}
                </Link>
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section>
        <Card className="border-primary/25 shadow-soft dark:border-primary/15 dark:shadow-soft-dark">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{tAnnounce("title")}</CardTitle>
              <CardDescription className="max-w-prose space-y-1">
                <span className="block">{t("announcementsHeroHint")}</span>
                {hasPermission(user, "CREATE_ANNOUNCEMENTS") ? (
                  <Link
                    href="/admin/announcements"
                    className="inline-block text-xs font-medium text-primary underline underline-offset-2"
                  >
                    {tAnnounce("composerLink")}
                  </Link>
                ) : null}
              </CardDescription>
            </div>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/annonces">{t("announcementsSeeAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {announcementsShown.map((a) => (
              <article
                key={a.id}
                className={cn(
                  "flex gap-3 rounded-xl border p-4 backdrop-blur-sm transition",
                  announcementAccentArticleClass(a.accentKey),
                  a.importance === "urgent" &&
                    "ring-2 ring-amber-500/35 ring-offset-2 ring-offset-background",
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
                      {a.importance === "urgent"
                        ? t("importanceUrgent")
                        : t("importanceNormal")}
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
            {sortedAnnouncements.length === 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{tAnnounce("empty")}</p>
                <p className="text-xs">{tAnnounce("emptyHint")}</p>
              </div>
            ) : sortedAnnouncements.length > announcementsShown.length ? (
              <p className="text-center text-xs text-muted-foreground">
                <Link
                  href="/annonces"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  {t("announcementsSeeAll")}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {(canMessage || canSanctions) && (
        <section
          className={cn(
            "grid gap-6",
            canMessage && canSanctions ? "lg:grid-cols-2" : "lg:grid-cols-1",
          )}
        >
          {canMessage ? (
            <Card className="shadow-none">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{t("messagingCardTitle")}</CardTitle>
                  <CardDescription>
                    {unreadTotal > 0
                      ? t("messagingUnreadSummary", { count: unreadTotal })
                      : t("messagingCaughtUp")}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/messagerie">{t("messagingSeeAll")}</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {messagingPreview.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("messagingEmpty")}
                  </p>
                ) : (
                  messagingPreview.map((c) => (
                    <Link
                      key={c.id}
                      href={`/messagerie/${c.id}`}
                      className={cn(
                        "flex flex-col gap-1 rounded-lg border border-border/70 bg-muted/15 px-3 py-2 transition hover:bg-muted/30",
                        c.unreadCount > 0 && "border-primary/30 bg-primary/[0.06]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug">
                          {c.title}
                        </span>
                        {c.unreadCount > 0 ? (
                          <Badge variant="default" className="shrink-0 text-[10px]">
                            {c.unreadCount > 99 ? "99+" : c.unreadCount}
                          </Badge>
                        ) : null}
                      </div>
                      {c.lastMessageSnippet ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {c.lastMessageSnippet}
                        </p>
                      ) : null}
                      {c.lastMessageAt ? (
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.lastMessageAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </p>
                      ) : null}
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          {canSanctions ? (
            <Card className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>{t("recentSanctions")}</CardTitle>
                  <CardDescription>{t("recentSanctionsHint")}</CardDescription>
                </div>
                <Badge variant="accent">{t("recentSanctionsLive")}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {sanctionsPreview.map((s) => (
                  <Link
                    key={s.id}
                    href={`/etudiants/${s.studentId}`}
                    className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-4 transition hover:bg-muted/35 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold">
                        {sanctionTypeLabel(s.type, localeShort)}
                      </p>
                      <p className="text-xs font-medium text-foreground">
                        {t("sanctionStudentLine", {
                          name:
                            sanctionStudentNames[s.studentId] ??
                            t("sanctionStudentUnknown"),
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.date), "PPp", { locale: dateLocale })}
                        {" · "}
                        {t("sanctionAuthorLine", {
                          author:
                            s.authorName && s.authorName !== "—"
                              ? s.authorName
                              : t("sanctionAuthorUnknown"),
                        })}
                      </p>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                    <Badge
                      variant={s.status === "active" ? "default" : "secondary"}
                      className="shrink-0 self-start sm:self-center"
                    >
                      {s.status === "active"
                        ? t("sanctionStatusActive")
                        : t("sanctionStatusRetired")}
                    </Badge>
                  </Link>
                ))}
                {sanctionsPreview.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("sanctionsEmpty")}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </section>
      )}
    </div>
  );
}
