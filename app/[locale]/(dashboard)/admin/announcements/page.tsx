import { AnnouncementsBulletin } from "@/components/announcements/announcements-bulletin";
import { PublishAnnouncementDialog } from "@/components/announcements/publish-announcement-dialog";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { fetchAnnouncements } from "@/lib/data/school";
import { orderAnnouncementsForBulletin } from "@/lib/announcements-order";
import { redirectToAccessDenied } from "@/lib/guards";
import { hasPermission } from "@/lib/permissions";
import { isStaffAdmin } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import type { AnnouncementAudience } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (
    !user ||
    !isStaffAdmin(user) ||
    !hasPermission(user, "CREATE_ANNOUNCEMENTS")
  ) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin.publishAnnouncement",
  });
  const tAdmin = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });

  const whoSeesBlocks: AnnouncementAudience[] = [
    "ALL_STAFF",
    "CLASSROOM_TEACHERS",
    "HEAD_TEACHERS_ONLY",
    "DIRECTION_ONLY",
  ];

  const items = orderAnnouncementsForBulletin(await fetchAnnouncements());

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={tAdmin("backToAdmin")} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        <PublishAnnouncementDialog locale={params.locale} />
      </div>

      <section className="rounded-xl border border-border bg-muted/20 p-4 md:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("whoSeesTitle")}
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {whoSeesBlocks.map((k) => (
            <li key={k}>
              <span className="font-medium text-foreground">
                {t(`whoSeesAudience.${k}`)}
              </span>
              {": "}
              {t(`whoSees.${k}`)}
            </li>
          ))}
        </ul>
      </section>

      <AnnouncementsBulletin
        announcements={items}
        locale={params.locale}
        canManage
      />
    </div>
  );
}
