import { getSessionUser } from "@/lib/session-server";
import { redirectToAccessDenied } from "@/lib/guards";
import { canManageTeacherAccounts } from "@/lib/roles";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AppLocale } from "@/i18n/routing";
import {
  fetchPendingTeacherDocumentsProfiles,
  fetchTeacherDocumentTemplates,
  fetchValidatedTeacherDocumentsProfiles,
} from "@/lib/data/teacher-documents";
import { fetchVoluntaryCampaignsForAdmin } from "@/lib/data/teacher-voluntary-documents";
import { fetchAllStaffForAdmin } from "@/lib/data/staff-admin";
import { TeacherDocumentsAdminPanel } from "@/components/admin/teacher-documents-admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminTeacherDocumentsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    redirectToAccessDenied(params.locale);
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return <div className="text-sm text-muted-foreground">Service indisponible.</div>;
  }

  const [templates, pendingRaw, validated, voluntaryCampaigns, staffList] = await Promise.all([
    fetchTeacherDocumentTemplates(admin),
    fetchPendingTeacherDocumentsProfiles(admin),
    fetchValidatedTeacherDocumentsProfiles(admin),
    fetchVoluntaryCampaignsForAdmin(admin),
    fetchAllStaffForAdmin(),
  ]);

  const pendingIds = pendingRaw.map((p) => p.id);
  let pending = pendingRaw.map((p) => ({
    ...p,
    totalRequests: 0,
    filledRequests: 0,
  }));

  if (pendingIds.length) {
    const { data: reqs } = await admin
      .from("teacher_document_requests")
      .select("teacher_profile_id, file_id")
      .in("teacher_profile_id", pendingIds);

    const meta = new Map<string, { total: number; filled: number }>();
    for (const id of pendingIds) {
      meta.set(id, { total: 0, filled: 0 });
    }
    for (const r of reqs ?? []) {
      const id = r.teacher_profile_id as string;
      const m = meta.get(id);
      if (!m) continue;
      m.total += 1;
      if (r.file_id) m.filled += 1;
    }
    pending = pending.map((p) => {
      const m = meta.get(p.id) ?? { total: 0, filled: 0 };
      return { ...p, totalRequests: m.total, filledRequests: m.filled };
    });
  }

  return (
    <TeacherDocumentsAdminPanel
      locale={params.locale}
      viewer={user}
      templates={templates}
      pending={pending}
      validated={validated}
      voluntaryCampaigns={voluntaryCampaigns}
      staffForVoluntaryPicker={staffList.filter(
        (s) => s.role === "PROFESSEUR" || s.role === "PROF_PRINCIPAL",
      )}
    />
  );
}
