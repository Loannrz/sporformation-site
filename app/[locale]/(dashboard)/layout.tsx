import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session-server";
import { redirect } from "@/i18n/navigation";
import { hasPermission } from "@/lib/permissions";
import { fetchDisciplineDialogOptions } from "@/lib/data/school";
import { fetchTotalUnreadMessageCount } from "@/lib/data/messaging";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import { fetchAdminSanctionsNewCount } from "@/lib/data/sanctions-admin";
import { fetchSiteLeadPendingTotal } from "@/lib/data/site-lead-forms";
import { countTeacherDocumentsAwaitingValidation } from "@/lib/data/teacher-documents";
import {
  canManageInscriptionSubmissions,
  canManageLeadForms,
  canManageSanctionsHubAsStaff,
} from "@/lib/pedago-access";
import {
  getCachedOpenVoluntaryRecipientsPending,
  getCachedVoluntaryRecipientsInvalidated,
} from "@/lib/data/teacher-voluntary-pending-cached";
import { fetchInscriptionSubmissionsBacklogTotal } from "@/lib/data/inscription-submissions-admin";

export default async function DashboardGroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (user) {
    const gateDocs = user.teacherDocumentsGateActive === true;

    const disciplineOptions =
      !gateDocs && hasPermission(user, "ADD_SANCTION")
        ? await fetchDisciplineDialogOptions()
        : null;

    const messagingUnread =
      !gateDocs && hasPermission(user, "SEND_MESSAGES")
        ? await fetchTotalUnreadMessageCount(user.id)
        : 0;

    const sanctionsReminderCount =
      !gateDocs && canManageSanctionsHubAsStaff(user)
        ? await fetchAdminSanctionsNewCount(user.id)
        : 0;

    const leadFormsPendingCount =
      !gateDocs &&
      (isDirector(user) || canManageLeadForms(user))
        ? await fetchSiteLeadPendingTotal()
        : 0;

    const teacherDocumentsPendingCount =
      !gateDocs && isStaffAdmin(user)
        ? await countTeacherDocumentsAwaitingValidation()
        : 0;

    const inscriptionSubmissionsPendingCount =
      !gateDocs && canManageInscriptionSubmissions(user)
        ? await fetchInscriptionSubmissionsBacklogTotal()
        : 0;

    const voluntaryDocPending =
      user.role === "PROFESSEUR" || user.role === "PROF_PRINCIPAL"
        ? await getCachedOpenVoluntaryRecipientsPending(user.id)
        : [];
    const voluntaryDocInvalidated =
      user.role === "PROFESSEUR" || user.role === "PROF_PRINCIPAL"
        ? await getCachedVoluntaryRecipientsInvalidated(user.id)
        : [];

    return (
      <DashboardShell
        user={user}
        disciplineOptions={disciplineOptions}
        notificationCount={messagingUnread}
        sanctionsReminderCount={sanctionsReminderCount}
        leadFormsPendingCount={leadFormsPendingCount}
        teacherDocumentsPendingCount={teacherDocumentsPendingCount}
        inscriptionSubmissionsPendingCount={inscriptionSubmissionsPendingCount}
        locale={params.locale}
        voluntaryDocPending={voluntaryDocPending}
        voluntaryDocInvalidated={voluntaryDocInvalidated}
      >
        {children}
      </DashboardShell>
    );
  }

  const supabase = await createServerSupabase();
  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      redirect({
        href: "/login?error=need_profile",
        locale: params.locale,
      });
    }
  }

  redirect({ href: "/login", locale: params.locale });
}
