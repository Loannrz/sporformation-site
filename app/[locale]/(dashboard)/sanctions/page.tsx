import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AdminSanctionsHubClient } from "@/components/admin/admin-sanctions-hub-client";
import {
  fetchActiveSanctionsForViewer,
  fetchAdminSanctionsLastSeenAt,
  fetchSanctionsCreatedSince,
  fetchSanctionsCreatedSinceForViewer,
} from "@/lib/data/sanctions-admin";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { canManageSanctionsHubAsStaff } from "@/lib/pedago-access";
import { redirectToAccessDenied } from "@/lib/guards";
import { canAccessSanctionsHub } from "@/lib/permissions";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function SanctionsHubPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !canAccessSanctionsHub(user)) {
    redirectToAccessDenied(params.locale);
  }

  const hubStaff = canManageSanctionsHubAsStaff(user);

  const [rows, lastSeen, ta, weekCount] = await Promise.all([
    fetchActiveSanctionsForViewer(user),
    hubStaff ? fetchAdminSanctionsLastSeenAt(user.id) : Promise.resolve(null),
    getTranslations({ locale: params.locale, namespace: "admin" }),
    (async () => {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 7);
      const iso = since.toISOString();
      return hubStaff
        ? fetchSanctionsCreatedSince(iso)
        : fetchSanctionsCreatedSinceForViewer(user, iso);
    })(),
  ]);

  const subtitle =
    hubStaff ? ta("sanctionsHub.pageSubtitle")
    : user.role === "ELEVE" ? ta("sanctionsHub.pageSubtitleStudent")
    : user.role === "PROF_PRINCIPAL" ? ta("sanctionsHub.pageSubtitlePrincipal")
    : ta("sanctionsHub.pageSubtitleProfessor");

  return (
    <div className="space-y-8">
      {hubStaff ? (
        <AdminBackLink href="/admin" label={ta("backToAdmin")} />
      ) : null}

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {ta("sanctionsHub.pageTitle")}
        </h1>
        <p className="max-w-2xl text-muted-foreground">{subtitle}</p>
      </div>

      <AdminSanctionsHubClient
        locale={params.locale}
        rows={rows}
        lastSeenIso={lastSeen}
        weekCreatedCount={weekCount}
        isDirector={isDirector(user)}
        hubMode={hubStaff ? "manage" : "readonly"}
        viewerRole={user.role}
        viewer={user}
      />
    </div>
  );
}
