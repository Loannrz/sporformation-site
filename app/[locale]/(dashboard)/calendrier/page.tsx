import { CalendarPageClient } from "@/components/calendar/calendar-page-client";
import { fetchCalendarEventsVisibleToUser } from "@/lib/data/calendar";
import {
  canManageSchoolCalendarAsStaff,
  enforcePedagoNav,
} from "@/lib/pedago-access";
import { getSessionUser } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function CalendarPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "calendar",
  });

  if (!user) {
    return null;
  }

  enforcePedagoNav(user, params.locale, "calendar");

  const events = await fetchCalendarEventsVisibleToUser(user);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("privacyHint")}</p>
      </div>

      <CalendarPageClient
        locale={params.locale}
        userId={user.id}
        canManageSchool={canManageSchoolCalendarAsStaff(user)}
        events={events}
      />
    </div>
  );
}
