import { getTranslations } from "next-intl/server";

import { AdminBackLink } from "@/components/admin/admin-back-link";
import { HistoryTimelineClient } from "@/components/admin/history-timeline-client";
import { redirectToAccessDenied } from "@/lib/guards";
import {
  ACTIVITY_CATEGORIES,
  fetchActivityLogsForDirector,
} from "@/lib/data/activity-logs";
import { isDirector } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminHistoryPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin.history",
  });

  const { rows } = await fetchActivityLogsForDirector({ limit: 400 });

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin" label={t("back")} />
      <HistoryTimelineClient
        locale={params.locale}
        rows={rows}
        categories={ACTIVITY_CATEGORIES}
      />
    </div>
  );
}
