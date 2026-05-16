import { AdminBackLink } from "@/components/admin/admin-back-link";
import { ClassAdminDetailForm } from "@/components/admin/class-admin-detail-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClassCloudFoldersPanel } from "@/components/admin/class-cloud-folders-panel";
import {
  fetchClassAdminDetailForAdmin,
  fetchClassCloudFolderTree,
  formatAcademicYearRange,
} from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";
import { redirectToAccessDenied } from "@/lib/guards";
import { canAccessClassesManagementAdmin } from "@/lib/pedago-access";
import { isDirector } from "@/lib/roles";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import {
  CalendarRange,
  Cloud,
  GraduationCap,
  Settings2,
  UserRound,
} from "lucide-react";

export default async function AdminClassDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  if (!user || !canAccessClassesManagementAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const [klass, folderTree] = await Promise.all([
    fetchClassAdminDetailForAdmin(params.id),
    fetchClassCloudFolderTree(params.id),
  ]);

  if (!klass) {
    notFound();
  }

  const tc = await getTranslations({
    locale: params.locale,
    namespace: "admin.classManage",
  });

  const yearRange = formatAcademicYearRange(
    klass.academicYearStart,
    klass.academicYearEnd,
  );

  return (
    <div className="space-y-8">
      <AdminBackLink
        href="/administration/classes"
        label={tc("backToList")}
      />

      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-muted/30 p-6 shadow-sm dark:from-primary/12 dark:to-card sm:p-8">
        <div
          className="pointer-events-none absolute -left-12 -bottom-20 h-56 w-56 rounded-full bg-primary/8 blur-3xl dark:bg-primary/12"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner dark:bg-primary/25">
              <GraduationCap className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0 space-y-3">
              <h1 className="text-balance text-3xl font-semibold tracking-tight">
                {tc("detailTitle", { name: klass.name })}
              </h1>
              <div className="flex flex-wrap gap-2">
                {yearRange ? (
                  <Badge variant="secondary" className="gap-1.5 py-1 font-normal">
                    <CalendarRange className="h-3 w-3" aria-hidden />
                    {yearRange}
                  </Badge>
                ) : null}
                {klass.principal ? (
                  <Badge variant="outline" className="gap-1.5 py-1 font-normal">
                    <UserRound className="h-3 w-3" aria-hidden />
                    {klass.principal.firstName} {klass.principal.lastName}
                  </Badge>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-dashed border-border/80 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                    {tc("principalUnset")}
                  </span>
                )}
              </div>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                {tc("principalDetailBlurb")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden border-border/70 shadow-md dark:border-border/80">
        <CardHeader className="flex flex-row items-start gap-4 border-b border-border/60 bg-muted/[0.35] pb-6 pt-6 dark:bg-muted/15 sm:gap-5 sm:p-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/60 dark:bg-card">
            <Settings2 className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl font-semibold">
              {tc("formSectionTitle")}
            </CardTitle>
            <CardDescription className="text-[0.9375rem] leading-relaxed">
              {tc("formSectionSubtitle")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <ClassAdminDetailForm
            locale={params.locale}
            initial={klass}
            canDeleteClass={isDirector(user)}
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/70 shadow-md dark:border-border/80">
        <CardHeader className="flex flex-row items-start gap-4 border-b border-border/60 bg-muted/[0.35] pb-6 pt-6 dark:bg-muted/15 sm:gap-5 sm:p-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/60 dark:bg-card">
            <Cloud className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl font-semibold">
              {tc("cloudSectionTitle")}
            </CardTitle>
            <CardDescription className="text-[0.9375rem] leading-relaxed">
              {tc("cloudSectionSubtitle")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <ClassCloudFoldersPanel
            locale={params.locale}
            classId={klass.id}
            initialTree={folderTree}
          />
        </CardContent>
      </Card>
    </div>
  );
}
