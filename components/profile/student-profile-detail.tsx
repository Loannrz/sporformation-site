import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  Calendar,
  GraduationCap,
  Mail,
  User,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AddSanctionForm } from "@/components/sanctions/add-sanction-form";
import { retireSanctionAction } from "@/app/actions/sanctions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sanctionTypeLabel } from "@/lib/sanction-labels";
import { formatCloudClassDisplayName } from "@/lib/data/school";
import {
  canDownloadSanctionPdf,
  canRemoveSanction,
  canViewRemovedHistory,
  hasPermission,
} from "@/lib/permissions";
import type { AppLocale } from "@/i18n/routing";
import type {
  Sanction,
  SchoolClass,
  SessionUser,
  StudentProfile,
} from "@/types";
import { cn } from "@/lib/utils";

function formatSexLabel(
  raw: string | null | undefined,
  empty: string,
  tr: (key: string) => string,
): string {
  if (!raw?.trim()) return empty;
  const u = raw.trim().toLowerCase();
  if (u === "f" || u === "féminin" || u === "feminin" || u === "female")
    return tr("sexFemale");
  if (u === "m" || u === "masculin" || u === "male") return tr("sexMale");
  if (u === "other" || u === "autre" || u === "x") return tr("sexOther");
  return raw.trim();
}

type Props = {
  locale: AppLocale;
  viewer: SessionUser;
  student: StudentProfile;
  clazz: SchoolClass | null;
  sanctions: Sanction[];
};

export async function StudentProfileDetail({
  locale,
  viewer,
  student,
  clazz,
  sanctions,
}: Props) {
  const tStudent = await getTranslations({ locale, namespace: "student" });
  const tSanctions = await getTranslations({ locale, namespace: "sanctions" });
  const dateLocale = locale === "fr" ? fr : enUS;

  const initials =
    `${student.firstName?.[0] ?? ""}${student.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?";

  const empty = tStudent("emptyField");
  const entryFormatted = student.entryDate
    ? format(new Date(student.entryDate), "PP", { locale: dateLocale })
    : empty;

  const birthFormatted = student.birthDate
    ? format(new Date(student.birthDate), "PP", { locale: dateLocale })
    : null;

  const classDisplay =
    clazz != null
      ? formatCloudClassDisplayName(
          clazz.name,
          clazz.academicYearStart ?? null,
          clazz.academicYearEnd ?? null,
        )
      : empty;

  const canPdf = canDownloadSanctionPdf(viewer, student.classId);

  const dl = locale === "en" ? "en" : "fr";

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <div
        className={cn(
          "overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
          "from-violet-500/[0.07] via-muted/35 to-background dark:from-violet-500/10 dark:via-muted/20",
        )}
      >
        <div className="flex flex-col gap-8 p-8 sm:flex-row sm:items-start sm:p-10">
          <Avatar className="h-28 w-28 shrink-0 border-4 border-background shadow-xl ring-1 ring-border/60">
            {student.photoUrl ? (
              <AvatarImage alt="" src={student.photoUrl} />
            ) : null}
            <AvatarFallback className="text-xl font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {tStudent("title", {
                first: student.firstName,
                last: student.lastName,
              })}
            </h1>
            <p className="text-sm font-medium text-muted-foreground">
              {tStudent("profileSubtitle")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary" className="font-normal">
                <GraduationCap className="mr-1 h-3.5 w-3.5" aria-hidden />
                {classDisplay}
              </Badge>
            </div>
            {student.email ? (
              <a
                href={`mailto:${student.email}`}
                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 py-2 text-sm shadow-sm backdrop-blur-sm transition hover:border-primary/35"
              >
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{student.email}</span>
              </a>
            ) : null}
            {clazz?.id ? (
              <div>
                <Button variant="outline" size="sm" asChild className="rounded-xl">
                  <Link href={`/classes/${clazz.id}`}>{tStudent("openClassPage")}</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {tStudent("sectionContact")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tStudent("fieldEmail")}
                </p>
                <p className="mt-1 font-medium break-all">
                  {student.email ?? empty}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {tStudent("inactiveLogin")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-muted-foreground" />
                {tStudent("sectionSchooling")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tStudent("fieldClass")}
                </p>
                <p className="mt-1 font-semibold">{classDisplay}</p>
                {clazz?.description ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {clazz.description}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tStudent("fieldEntryDate")}
                </p>
                <p className="mt-1 flex items-center gap-2 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {entryFormatted}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-muted-foreground" />
                {tStudent("sectionCivil")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tStudent("fieldBirthDate")}
                </p>
                <p className="mt-1 font-medium">{birthFormatted ?? empty}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tStudent("fieldSex")}
                </p>
                <p className="mt-1 font-medium">
                  {formatSexLabel(student.sex, empty, (k) => tStudent(k))}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tStudent("fieldBirthPlace")}
                </p>
                <p className="mt-1 font-medium">
                  {student.birthPlace?.trim() ? student.birthPlace : empty}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {hasPermission(viewer, "ADD_SANCTION") ? (
            <AddSanctionForm studentId={student.id} locale={locale} />
          ) : null}

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">{tStudent("sanctions")}</CardTitle>
              <CardDescription className="space-y-2 text-pretty">
                <span className="block">{tStudent("sanctionsHistoryHint")}</span>
                <span className="block text-xs text-muted-foreground">
                  {tSanctions("pdfSent")}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sanctions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tStudent("sanctionsEmpty")}
                </p>
              ) : (
                sanctions.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-border/80 bg-muted/15 p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold capitalize">
                            {sanctionTypeLabel(s.type, dl)}
                          </p>
                          <Badge
                            variant={
                              s.status === "active" ? "default" : "secondary"
                            }
                            className="capitalize"
                          >
                            {s.status === "active"
                              ? tSanctions("statusActive")
                              : tSanctions("statusRetired")}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {format(new Date(s.date), "PP pp", {
                            locale: dateLocale,
                          })}
                        </p>
                        {s.authorName.trim() ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tStudent("sanctionByAuthor", {
                              author: s.authorName,
                            })}
                          </p>
                        ) : null}
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {s.description}
                        </p>
                        {s.status === "retired" &&
                          (canViewRemovedHistory(viewer) ||
                            (viewer.role === "PROF_PRINCIPAL" &&
                              viewer.principalClassIds?.includes(
                                student.classId,
                              ))) ? (
                          <p className="mt-3 text-xs italic text-muted-foreground">
                            {tSanctions("retiredMeta", {
                              name: s.retiredByName ?? "—",
                              date: format(
                                new Date(s.retiredAt ?? s.date),
                                "PP pp",
                                { locale: dateLocale },
                              ),
                            })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        {canPdf ? (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={`/api/pdf/sanction?id=${encodeURIComponent(s.id)}&locale=${locale}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {tStudent("pdfDownload")}
                            </a>
                          </Button>
                        ) : null}
                        {canRemoveSanction(viewer, s, student.classId) &&
                        s.status === "active" ? (
                          <form action={retireSanctionAction}>
                            <input type="hidden" name="sanctionId" value={s.id} />
                            <input
                              type="hidden"
                              name="studentId"
                              value={student.id}
                            />
                            <input type="hidden" name="locale" value={locale} />
                            <Button type="submit" variant="secondary" size="sm">
                              {tStudent("removeSanction")}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
