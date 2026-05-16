import { DashboardHome } from "@/components/dashboard/dashboard-home";
import {
  fetchAnnouncementsForUser,
  fetchClassById,
  fetchDashboardDirectorStats,
  fetchRecentSanctionsForUser,
  fetchStudentDisplayNamesByIds,
} from "@/lib/data/school";
import { fetchMessagingConversationsList } from "@/lib/data/messaging";
import { canAccessSanctionsHub, hasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { enforcePedagoNav } from "@/lib/pedago-access";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  const locale = params.locale;

  if (!user) {
    return null;
  }

  enforcePedagoNav(user, locale, "dashboard");

  const localeShort = locale === "fr" ? "fr" : "en";
  const showEstablishmentStats =
    user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR";

  const [
    announcements,
    sanctionsPreview,
    directorStats,
    messagingList,
    studentClass,
  ] = await Promise.all([
    fetchAnnouncementsForUser(user),
    canAccessSanctionsHub(user)
      ? fetchRecentSanctionsForUser(user, 3)
      : Promise.resolve([]),
    showEstablishmentStats
      ? fetchDashboardDirectorStats()
      : Promise.resolve(null),
    hasPermission(user, "SEND_MESSAGES")
      ? fetchMessagingConversationsList(user.id, localeShort)
      : Promise.resolve([]),
    user.role === "ELEVE" && user.studentClassId
      ? fetchClassById(user.studentClassId)
      : Promise.resolve(null),
  ]);

  const unreadTotal = messagingList.reduce((s, c) => s + c.unreadCount, 0);
  const messagingPreview = messagingList.slice(0, 4);

  const sanctionStudentNames =
    sanctionsPreview.length > 0
      ? Object.fromEntries(
          await fetchStudentDisplayNamesByIds(
            sanctionsPreview.map((s) => s.studentId),
          ),
        )
      : {};

  return (
    <DashboardHome
      locale={locale}
      user={user}
      announcements={announcements}
      sanctionsPreview={sanctionsPreview}
      sanctionStudentNames={sanctionStudentNames}
      directorStats={directorStats}
      messagingPreview={messagingPreview}
      unreadTotal={unreadTotal}
      studentClass={studentClass}
    />
  );
}
