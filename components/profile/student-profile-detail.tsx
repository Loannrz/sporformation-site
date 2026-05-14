import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  GraduationCap,
  Home,
  Mail,
  Phone,
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
import type { ReactNode } from "react";

type ProfileSectionTone =
  | "indigo"
  | "emerald"
  | "violet"
  | "amber"
  | "sky"
  | "slate";

const SECTION_ACCENTS: Record<
  ProfileSectionTone,
  { header: string; iconBg: string }
> = {
  indigo: {
    header:
      "bg-gradient-to-r from-primary/[0.09] via-card to-accent/[0.06] dark:from-primary/[0.14] dark:to-accent/[0.08]",
    iconBg:
      "bg-primary/15 text-primary shadow-inner ring-1 ring-primary/20",
  },
  emerald: {
    header:
      "bg-gradient-to-r from-emerald-500/[0.08] via-card to-teal-500/[0.05] dark:from-emerald-500/[0.12]",
    iconBg:
      "bg-emerald-500/15 text-emerald-700 shadow-inner ring-1 ring-emerald-500/25 dark:text-emerald-300",
  },
  violet: {
    header:
      "bg-gradient-to-r from-violet-500/[0.08] via-card to-purple-500/[0.05] dark:from-violet-500/[0.12]",
    iconBg:
      "bg-violet-500/15 text-violet-700 shadow-inner ring-1 ring-violet-500/25 dark:text-violet-300",
  },
  amber: {
    header:
      "bg-gradient-to-r from-amber-500/[0.09] via-card to-orange-500/[0.05] dark:from-amber-500/[0.12]",
    iconBg:
      "bg-amber-500/15 text-amber-800 shadow-inner ring-1 ring-amber-500/30 dark:text-amber-200",
  },
  sky: {
    header:
      "bg-gradient-to-r from-sky-500/[0.08] via-card to-cyan-500/[0.05] dark:from-sky-500/[0.12]",
    iconBg:
      "bg-sky-500/15 text-sky-800 shadow-inner ring-1 ring-sky-500/25 dark:text-sky-200",
  },
  slate: {
    header:
      "bg-gradient-to-r from-muted/80 via-card to-muted/40 dark:from-muted/25 dark:to-muted/10",
    iconBg:
      "bg-muted text-muted-foreground shadow-inner ring-1 ring-border dark:bg-muted/80",
  },
};

function ProfileSectionCard({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: ProfileSectionTone;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  const a = SECTION_ACCENTS[tone];
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:bg-card dark:ring-white/[0.06]">
      <div
        className={cn(
          "flex items-center gap-3 border-b border-border/55 px-5 py-4",
          a.header,
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            a.iconBg,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function InfoTile({
  label,
  children,
  muted,
  className,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        muted
          ? "border-dashed border-border/45 bg-muted/15 dark:bg-muted/10"
          : "border-border/60 bg-muted/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:bg-muted/15",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div
        className={cn(
          "mt-1.5 break-words text-sm font-semibold leading-snug",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

const SANCTION_CARD_ACCENTS = [
  "border-l-[3px] border-l-primary/55 bg-gradient-to-br from-primary/[0.07] via-card to-transparent shadow-sm dark:from-primary/[0.11]",
  "border-l-[3px] border-l-accent/55 bg-gradient-to-br from-accent/[0.06] via-card to-transparent shadow-sm dark:from-accent/[0.1]",
  "border-l-[3px] border-l-violet-500/45 bg-gradient-to-br from-violet-500/[0.06] via-card to-transparent shadow-sm dark:from-violet-500/[0.1]",
] as const;

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
  /** Direction / administration : boutons modifier ou supprimer la fiche. */
  staffToolbar?: ReactNode;
};

export async function StudentProfileDetail({
  locale,
  viewer,
  student,
  clazz,
  sanctions,
  staffToolbar,
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
        <div className="flex flex-col gap-6 p-8 sm:p-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-8 sm:flex-row sm:items-start">
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
          {staffToolbar ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{staffToolbar}</div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-5 xl:col-span-4">
          <ProfileSectionCard
            tone="indigo"
            icon={Mail}
            title={tStudent("sectionContact")}
          >
            <div className="space-y-3">
              <Field
                label={tStudent("fieldEmail")}
                value={student.email}
                empty={empty}
              />
              <p className="rounded-xl border border-dashed border-border/50 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground dark:bg-muted/10">
                {tStudent("inactiveLogin")}
              </p>
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            tone="emerald"
            icon={Users}
            title={tStudent("sectionSchooling")}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] to-transparent px-4 py-3 dark:from-emerald-500/[0.12]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {tStudent("fieldClass")}
                </p>
                <p className="mt-1.5 text-base font-semibold text-foreground">
                  {classDisplay}
                </p>
                {clazz?.description ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {clazz.description}
                  </p>
                ) : null}
              </div>
              <InfoTile
                label={tStudent("fieldEntryDate")}
                muted={!student.entryDate}
              >
                <span className="inline-flex items-center gap-2">
                  <Calendar
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600/85 dark:text-emerald-400"
                    aria-hidden
                  />
                  {entryFormatted}
                </span>
              </InfoTile>
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            tone="violet"
            icon={User}
            title={tStudent("sectionCivil")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile
                label={tStudent("fieldBirthDate")}
                muted={!birthFormatted}
              >
                {birthFormatted ?? empty}
              </InfoTile>
              <InfoTile label={tStudent("fieldSex")} muted={!student.sex?.trim()}>
                {formatSexLabel(student.sex, empty, (k) => tStudent(k))}
              </InfoTile>
              <div className="sm:col-span-2">
                <Field
                  label={tStudent("fieldBirthPlace")}
                  value={student.birthPlace}
                  empty={empty}
                />
              </div>
              <Field
                label={tStudent("fieldBirthDepartment")}
                value={student.birthDepartment}
                empty={empty}
              />
              <Field
                label={tStudent("fieldBirthCountry")}
                value={student.birthCountry}
                empty={empty}
              />
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            tone="amber"
            icon={BookOpen}
            title={tStudent("sectionFormation")}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={tStudent("fieldPromo")}
                value={student.promo}
                empty={empty}
              />
              <Field
                label={tStudent("fieldOfName")}
                value={student.ofName}
                empty={empty}
              />
              <Field
                label={tStudent("fieldFormationNumber")}
                value={student.formationNumber}
                empty={empty}
              />
              <Field
                label={tStudent("fieldDiploma")}
                value={student.diploma}
                empty={empty}
              />
              <Field
                label={tStudent("fieldNjs")}
                value={student.njs}
                empty={empty}
              />
              <Field
                label={tStudent("fieldTep")}
                value={student.tep}
                empty={empty}
              />
            </div>
          </ProfileSectionCard>
        </aside>

        <div className="space-y-8 lg:col-span-7 xl:col-span-8">
          {hasPermission(viewer, "ADD_SANCTION") ? (
            <ProfileSectionCard
              tone="amber"
              icon={GraduationCap}
              title={tStudent("sectionReportSanction")}
            >
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                {tStudent("sectionReportSanctionDesc")}
              </p>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-4 dark:bg-muted/10">
                <AddSanctionForm
                  studentId={student.id}
                  locale={locale}
                  embedded
                />
              </div>
            </ProfileSectionCard>
          ) : null}

          <ProfileSectionCard tone="indigo" icon={ClipboardList} title={tStudent("sanctions")}>
            <div className="mb-5 space-y-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm dark:bg-primary/[0.07]">
              <p className="text-muted-foreground">{tStudent("sanctionsHistoryHint")}</p>
              <p className="text-xs text-muted-foreground">{tSanctions("pdfSent")}</p>
            </div>
            <div className="space-y-4">
              {sanctions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center dark:bg-muted/10">
                  <p className="text-sm font-medium text-muted-foreground">
                    {tStudent("sanctionsEmpty")}
                  </p>
                </div>
              ) : (
                sanctions.map((s, idx) => (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-2xl border border-border/70 p-5",
                      SANCTION_CARD_ACCENTS[idx % SANCTION_CARD_ACCENTS.length],
                    )}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold capitalize text-foreground">
                            {sanctionTypeLabel(s.type, dl)}
                          </p>
                          <Badge
                            variant={
                              s.status === "active" ? "default" : "secondary"
                            }
                            className="capitalize shadow-none"
                          >
                            {s.status === "active"
                              ? tSanctions("statusActive")
                              : tSanctions("statusRetired")}
                          </Badge>
                        </div>
                        {s.title?.trim() ? (
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {s.title.trim()}
                          </p>
                        ) : null}
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
                        <p className="mt-3 text-sm leading-relaxed text-foreground/85">
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
                          <Button asChild variant="outline" size="sm" className="rounded-xl">
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
                            <Button type="submit" variant="secondary" size="sm" className="rounded-xl">
                              {tStudent("removeSanction")}
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            tone="slate"
            icon={Home}
            title={`${tStudent("sectionContactDetails")} · ${tStudent("sectionStatus")}`}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label={tStudent("fieldPhone")}
                  value={student.phone}
                  empty={empty}
                  icon={<Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label={tStudent("fieldAddressLine1")}
                  value={student.addressLine1}
                  empty={empty}
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label={tStudent("fieldAddressLine2")}
                  value={student.addressLine2}
                  empty={empty}
                />
              </div>
              <Field
                label={tStudent("fieldPostalCode")}
                value={student.postalCode}
                empty={empty}
              />
              <Field
                label={tStudent("fieldAddressCity")}
                value={student.addressCity}
                empty={empty}
              />
              <div className="sm:col-span-2">
                <Field
                  label={tStudent("fieldAddressCountry")}
                  value={student.addressCountry}
                  empty={empty}
                />
              </div>
            </div>
            <div
              className="my-6 border-t border-border/55"
              aria-hidden
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={tStudent("fieldEmploymentStatus")}
                value={student.employmentStatus}
                empty={empty}
              />
              <Field
                label={tStudent("fieldParcoursup")}
                value={student.parcoursup}
                empty={empty}
              />
              <div className="sm:col-span-2">
                <Field
                  label={tStudent("fieldValidationStatus")}
                  value={student.validationStatus}
                  empty={empty}
                />
              </div>
              <Field
                label={tStudent("fieldUc1")}
                value={student.uc1Status}
                empty={empty}
              />
              <Field
                label={tStudent("fieldUc2")}
                value={student.uc2Status}
                empty={empty}
              />
              <Field
                label={tStudent("fieldUc3")}
                value={student.uc3Status}
                empty={empty}
              />
              <Field
                label={tStudent("fieldUc4")}
                value={student.uc4Status}
                empty={empty}
              />
            </div>
          </ProfileSectionCard>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  empty,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  empty: string;
  icon?: React.ReactNode;
}) {
  const display = value && String(value).trim() ? String(value).trim() : empty;
  const isEmpty = display === empty;
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        isEmpty
          ? "border-dashed border-border/45 bg-muted/15 dark:bg-muted/10"
          : "border-border/60 bg-muted/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:bg-muted/15",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 flex items-start gap-2 break-words text-sm leading-snug",
          isEmpty
            ? "font-medium text-muted-foreground"
            : "font-semibold text-foreground",
        )}
      >
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <span>{display}</span>
      </p>
    </div>
  );
}
