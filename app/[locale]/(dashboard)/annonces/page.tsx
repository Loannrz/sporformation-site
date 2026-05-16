import { AnnouncementsBulletin } from "@/components/announcements/announcements-bulletin";
import { PublishAnnouncementDialog } from "@/components/announcements/publish-announcement-dialog";
import { fetchAnnouncementsForUser } from "@/lib/data/school";
import { orderAnnouncementsForBulletin } from "@/lib/announcements-order";
import { hasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { enforcePedagoNav } from "@/lib/pedago-access";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (user) {
    enforcePedagoNav(user, params.locale, "announcements");
  }
  const t = await getTranslations({
    locale: params.locale,
    namespace: "announcements",
  });
  const canManage = Boolean(
    user && hasPermission(user, "CREATE_ANNOUNCEMENTS"),
  );

  const raw = user ? await fetchAnnouncementsForUser(user) : [];
  const items = orderAnnouncementsForBulletin(raw);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
          {!canManage ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("readOnlyHint")}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <PublishAnnouncementDialog locale={params.locale} />
        ) : null}
      </div>
      <AnnouncementsBulletin
        announcements={items}
        locale={params.locale}
        canManage={canManage}
      />
    </div>
  );
}
