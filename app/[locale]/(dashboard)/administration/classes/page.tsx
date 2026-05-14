import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AdminClassesSearchableList } from "@/components/admin/admin-classes-searchable-list";
import { CreateClassModal } from "@/components/admin/create-class-modal";
import { fetchClassesWithStudentsForAdmin } from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { GraduationCap } from "lucide-react";

export default async function AdminClassesPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }

  const classes = await fetchClassesWithStudentsForAdmin();

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const tc = await getTranslations({
    locale: params.locale,
    namespace: "admin.classManage",
  });

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={t("backToAdmin")} />

      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.06] via-card to-card p-6 shadow-sm dark:from-primary/10 dark:via-card sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner dark:bg-primary/20">
              <GraduationCap className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="text-balance text-3xl font-semibold tracking-tight">
                {t("classesTitle")}
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground sm:text-[0.9375rem]">
                {tc("listSubtitle")}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <CreateClassModal locale={params.locale} />
          </div>
        </div>
      </div>

      <AdminClassesSearchableList classes={classes} />
    </div>
  );
}
