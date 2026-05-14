import {
  BookOpen,
  Building2,
  Calendar,
  Mail,
  GraduationCap,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { StaffAdminRow } from "@/lib/data/staff-admin";
import {
  formatCloudClassDisplayName,
  type AdminClassOption,
} from "@/lib/data/school";
import { canManageTeacherAccounts } from "@/lib/roles";
import type { AppLocale } from "@/i18n/routing";
import type { SessionUser, TeacherEmploymentStatus } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  staff: StaffAdminRow;
  classOptions: AdminClassOption[];
  viewer: SessionUser;
  locale: AppLocale;
};

function classLabelFromOptions(
  options: AdminClassOption[],
  id: string,
): string | null {
  const row = options.find((c) => c.id === id);
  if (!row) return null;
  return formatCloudClassDisplayName(
    row.name,
    row.academicYearStart,
    row.academicYearEnd,
  );
}

export async function StaffProfileDetail({
  staff,
  classOptions,
  viewer,
  locale,
}: Props) {
  const tp = await getTranslations({ locale, namespace: "profiles" });
  const tc = await getTranslations({ locale, namespace: "common" });
  const ta = await getTranslations({ locale, namespace: "admin.accounts" });

  const initials =
    `${staff.firstName?.[0] ?? ""}${staff.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?";

  const roleHuman =
    staff.role === "DIRECTEUR"
      ? tc("roleDirector")
      : staff.role === "ADMINISTRATEUR"
        ? tc("roleAdministrator")
        : staff.role === "PROF_PRINCIPAL"
          ? tc("rolePrincipal")
          : tc("roleTeacher");

  const joined = staff.joinedAt
    ? format(new Date(staff.joinedAt), "yyyy-MM-dd")
    : tp("staffNoDate");

  const employmentLabel = (status: TeacherEmploymentStatus | null) => {
    if (!status) return null;
    switch (status) {
      case "NEW_TO_SCHOOL":
        return ta("employmentNew");
      case "ACTIVE_AT_SCHOOL":
        return ta("employmentActive");
      case "FORMER_INACTIVE":
        return ta("employmentFormer");
      default:
        return null;
    }
  };
  const emp = employmentLabel(staff.teacherEmploymentStatus);

  const principalLabels = (staff.principalClassIds ?? [])
    .map((id) => classLabelFromOptions(classOptions, id))
    .filter(Boolean) as string[];

  const assignedLabels = staff.assignedClassIds
    .map((id) => classLabelFromOptions(classOptions, id))
    .filter(Boolean) as string[];

  const showAdminLink =
    canManageTeacherAccounts(viewer) &&
    (staff.role === "PROFESSEUR" || staff.role === "PROF_PRINCIPAL");

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div
        className={cn(
          "overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
          "from-muted/50 via-muted/30 to-background dark:from-muted/35 dark:via-muted/20",
        )}
      >
        <div className="flex flex-col gap-8 p-8 sm:flex-row sm:items-start sm:p-10">
          <Avatar className="h-32 w-32 shrink-0 border-4 border-background shadow-xl ring-1 ring-border/60">
            {staff.avatarUrl ? (
              <AvatarImage alt="" src={staff.avatarUrl} />
            ) : null}
            <AvatarFallback className="text-2xl font-semibold tracking-tight">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-start gap-2 sm:gap-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {staff.firstName} {staff.lastName}
              </h1>
              {!staff.activeAtEstablishment ? (
                <Badge
                  variant="outline"
                  className="shrink-0 text-amber-900 dark:text-amber-200"
                >
                  {ta("badgeLeft")}
                </Badge>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/90 font-medium text-primary-foreground">
                {roleHuman}
              </Badge>
              {emp ? (
                <Badge variant="outline" className="font-normal">
                  {emp}
                </Badge>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
              {tp("subtitle", { role: roleHuman, joined })}
            </p>

            <a
              href={staff.email ? `mailto:${staff.email}` : undefined}
              className={cn(
                "inline-flex w-fit max-w-full items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-3 py-2 text-sm font-medium shadow-sm backdrop-blur-sm transition",
                "hover:border-primary/35 hover:bg-muted/50",
                !staff.email && "pointer-events-none opacity-60",
              )}
            >
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{staff.email || "—"}</span>
            </a>

            {showAdminLink ? (
              <div>
                <Link
                  href={`/administration/comptes/${staff.id}`}
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {tp("staffEditInAdmin")}
                </Link>
              </div>
            ) : null}

            {!staff.activeAtEstablishment && staff.leftEstablishmentOn ? (
              <p className="text-xs text-muted-foreground">
                {ta("leftOnLabel")}:{" "}
                {format(new Date(staff.leftEstablishmentOn), "yyyy-MM-dd")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              {tp("staffSectionAbout")}
            </CardTitle>
            <CardDescription>{tp("staffSectionAboutHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90">
              {staff.bio?.trim() ? staff.bio : tp("staffEmptyBio")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              {tp("staffSectionSubjects")}
            </CardTitle>
            <CardDescription>{tp("staffSectionSubjectsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {staff.subjects && staff.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {staff.subjects.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-xs font-semibold text-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{tp("staffNoSubjects")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {tp("staffSectionTenure")}
            </CardTitle>
            <CardDescription>{tp("staffSectionTenureHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-border/60 py-2">
              <span className="text-muted-foreground">{tp("staffJoinedAt")}</span>
              <span className="font-medium">{joined}</span>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <span className="text-muted-foreground">{tp("staffAccountStatus")}</span>
              <span className="font-medium">
                {staff.activeAtEstablishment
                  ? tp("staffStatusActive")
                  : tp("staffStatusInactive")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              {tp("staffSectionClasses")}
            </CardTitle>
            <CardDescription>{tp("staffSectionClassesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-red-600 dark:text-red-400" />
                {tp("staffPrincipalClasses")}
              </div>
              {principalLabels.length > 0 ? (
                <ul className="space-y-2">
                  {principalLabels.map((label) => (
                    <li
                      key={label}
                      className="rounded-xl border border-red-600/35 bg-red-500/[0.06] px-3 py-2 text-sm dark:border-red-500/40 dark:bg-red-500/[0.08]"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{tp("staffNoPrincipalClasses")}</p>
              )}
            </div>
            <Separator className="md:hidden" />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <GraduationCap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                {tp("staffAssignedClasses")}
              </div>
              {assignedLabels.length > 0 ? (
                <ul className="space-y-2">
                  {assignedLabels.map((label) => (
                    <li
                      key={label}
                      className="rounded-xl border border-border/70 bg-muted/25 px-3 py-2 text-sm"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{tp("staffNoAssignedClasses")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-muted/15 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">{tp("staffComplianceTitle")}</CardTitle>
          <CardDescription className="text-pretty">
            {viewer.role === "DIRECTEUR" || viewer.role === "ADMINISTRATEUR"
              ? tp("staffComplianceDirector")
              : tp("staffComplianceStaff")}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
