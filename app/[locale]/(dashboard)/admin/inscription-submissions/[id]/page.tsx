import { AdminBackLink } from "@/components/admin/admin-back-link";
import { InscriptionSubmissionDetailClient } from "@/components/admin/inscription-submission-detail-client";
import { getInscriptionSubmissionAdminById } from "@/lib/data/inscription-submissions-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { canManageInscriptionSubmissions } from "@/lib/pedago-access";
import { redirectToAccessDenied } from "@/lib/guards";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function AdminInscriptionSubmissionDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  if (!user || !canManageInscriptionSubmissions(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const ts = await getTranslations({
    locale: params.locale,
    namespace: "admin.inscriptionSubmissions",
  });

  const admin = createAdminSupabase();
  if (!admin) notFound();

  const row = await getInscriptionSubmissionAdminById(admin, params.id);
  if (!row) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <AdminBackLink href="/admin" label={t("backToAdmin")} />
        <span className="text-muted-foreground">/</span>
        <Link href="/admin/inscription-submissions" className="text-sm font-medium hover:underline">
          {ts("pageTitle")}
        </Link>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {ts("detailEyebrow")}
      </p>

      <InscriptionSubmissionDetailClient
        locale={params.locale}
        submissionId={row.id}
        initial={row}
      />
    </div>
  );
}
