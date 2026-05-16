import { SiteLeadFormsPanel } from "@/components/admin/site-lead-forms-panel";
import {
  fetchSiteLeadEmployers,
  fetchSiteLeadStudents,
  fetchSiteLeadTeps,
} from "@/lib/data/site-lead-forms";
import { redirectToAccessDenied } from "@/lib/guards";
import { canManageLeadForms } from "@/lib/pedago-access";
import { getSessionUser } from "@/lib/session-server";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function AdminLeadFormsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) {
    redirectToAccessDenied(params.locale);
  }

  const [students, employers, teps] = await Promise.all([
    fetchSiteLeadStudents(),
    fetchSiteLeadEmployers(),
    fetchSiteLeadTeps(),
  ]);

  return (
    <SiteLeadFormsPanel
      locale={params.locale}
      students={students}
      employers={employers}
      teps={teps}
    />
  );
}
