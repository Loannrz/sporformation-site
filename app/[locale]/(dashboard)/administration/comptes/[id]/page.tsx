import { AdminBackLink } from "@/components/admin/admin-back-link";
import { TeacherAdminPanel } from "@/components/admin/teacher-admin-panel";
import { Badge } from "@/components/ui/badge";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchStaffByIdForAdmin } from "@/lib/data/staff-admin";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { ExternalLink, Mail } from "lucide-react";
import type { TeacherEmploymentStatus } from "@/types";

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const viewer = await getSessionUser();
  if (!viewer || !isStaffAdmin(viewer)) {
    redirectToAccessDenied(params.locale);
  }

  const [staff, classOptions] = await Promise.all([
    fetchStaffByIdForAdmin(params.id),
    fetchAdminClassOptions(),
  ]);
  if (!staff) {
    notFound();
  }

  if (
    viewer.role === "ADMINISTRATEUR" &&
    staff.role !== "PROFESSEUR" &&
    staff.role !== "PROF_PRINCIPAL"
  ) {
    redirectToAccessDenied(params.locale);
  }

  const ta = await getTranslations({
    locale: params.locale,
    namespace: "admin.accounts",
  });

  const initials =
    `${staff.firstName?.[0] ?? ""}${staff.lastName?.[0] ?? ""}`.toUpperCase() ||
    "?";

  const roleBadge = (() => {
    switch (staff.role) {
      case "DIRECTEUR":
        return ta("roleDirector");
      case "ADMINISTRATEUR":
        return ta("roleAdministrator");
      case "PROF_PRINCIPAL":
        return ta("rolePrincipal");
      case "PROFESSEUR":
        return ta("roleTeacher");
      default:
        return staff.role;
    }
  })();

  const employmentBadge = (status: TeacherEmploymentStatus | null) => {
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

  const emp = employmentBadge(staff.teacherEmploymentStatus);

  return (
    <div className="space-y-8">
      <AdminBackLink
        href="/administration/comptes"
        label={ta("backToAccounts")}
      />

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div
          className="h-1.5 bg-gradient-to-r from-primary/90 via-primary/70 to-accent/75"
          aria-hidden
        />
        <div className="relative bg-gradient-to-b from-muted/35 via-background to-background px-5 py-8 sm:px-8 sm:py-10 dark:from-muted/15">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-5">
              <div
                className="flex size-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-xl font-semibold text-primary shadow-inner"
                aria-hidden
              >
                {initials}
              </div>
              <div className="min-w-0 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {ta("manageCardTitle")}
                </p>
                <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  {staff.firstName} {staff.lastName}
                </h1>
                {staff.email ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-4 shrink-0 opacity-70" aria-hidden />
                    <span className="truncate">{staff.email}</span>
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary" className="font-normal">
                    {roleBadge}
                  </Badge>
                  {emp ? (
                    <Badge variant="outline" className="font-normal">
                      {emp}
                    </Badge>
                  ) : null}
                  {staff.mustSetPassword ? (
                    <Badge variant="secondary" className="font-normal">
                      {ta("badgePendingPassword")}
                    </Badge>
                  ) : null}
                  {!staff.activeAtEstablishment ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500/50 font-normal text-amber-900 dark:text-amber-100"
                    >
                      {ta("badgeLeft")}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <Link
              href={`/profil/${staff.id}`}
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-border/80 bg-background/90 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm",
                "transition-colors hover:border-primary/35 hover:bg-muted/60",
              )}
            >
              <ExternalLink className="size-4 opacity-70" aria-hidden />
              {ta("openPublicProfile")}
            </Link>
          </div>

          <div className="mt-10 border-t border-border/60 pt-10">
            <p className="mb-8 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {ta("manageCardHint")}
            </p>
            <TeacherAdminPanel
              locale={params.locale}
              staff={staff}
              viewerId={viewer.id}
              viewerRole={viewer.role}
              classOptions={classOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
