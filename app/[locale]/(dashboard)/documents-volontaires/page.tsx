import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/session-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AppLocale } from "@/i18n/routing";
import { fetchVoluntaryRecipientsForTeacherPage } from "@/lib/data/teacher-voluntary-documents";
import { TeacherVoluntaryDocumentsPanel } from "@/components/teacher-documents/teacher-voluntary-documents-panel";

export const dynamic = "force-dynamic";

export default async function DocumentsVolontairesPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "voluntaryDocuments",
  });

  if (!user) {
    redirect({ href: "/login", locale: params.locale });
    return null;
  }

  if (user.role !== "PROFESSEUR" && user.role !== "PROF_PRINCIPAL") {
    redirect({ href: "/dashboard", locale: params.locale });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return <div className="text-sm text-muted-foreground">{t("configError")}</div>;
  }

  const rows = await fetchVoluntaryRecipientsForTeacherPage(admin, user.id);
  const pendingOnly = rows.filter((r) => !r.file_id);

  return (
    <TeacherVoluntaryDocumentsPanel locale={params.locale} requests={rows} pendingCount={pendingOnly.length} />
  );
}
