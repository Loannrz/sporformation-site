import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionUser } from "@/lib/session-server";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { Link, redirect } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  Users,
  School,
  GraduationCap,
  Megaphone,
  CalendarDays,
  ClipboardList,
  History,
} from "lucide-react";
import {
  fetchActiveSanctionsCount,
  fetchAdminSanctionsNewCount,
} from "@/lib/data/sanctions-admin";

export default async function AdminHubPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin.hub",
  });

  const director = isDirector(user);

  if (!director) {
    redirect({ href: "/admin/users", locale: params.locale });
  }

  const [sanctionsActiveCount, sanctionsNewCount] = await Promise.all([
    fetchActiveSanctionsCount(),
    fetchAdminSanctionsNewCount(user.id),
  ]);

  const cards = [
    {
      href: "/administration/classes",
      title: t("classesTitle"),
      desc: t("classesDesc"),
      Icon: School,
      badgeCount: 0,
    },
    {
      href: "/admin/users",
      title: t("usersTitle"),
      desc: t("usersDesc"),
      Icon: Users,
      badgeCount: 0,
    },
    {
      href: "/admin/students",
      title: t("studentsTitle"),
      desc: t("studentsDesc"),
      Icon: GraduationCap,
      badgeCount: 0,
    },
    {
      href: "/admin/calendar",
      title: t("calendarTitle"),
      desc: t("calendarDesc"),
      Icon: CalendarDays,
      badgeCount: 0,
    },
    {
      href: "/sanctions",
      title: t("sanctionsHubTitle"),
      desc: t("sanctionsHubDesc", { activeCount: sanctionsActiveCount }),
      Icon: ClipboardList,
      badgeCount: sanctionsNewCount,
    },
    {
      href: "/admin/announcements",
      title: t("announcementsTitle"),
      desc: t("announcementsDesc"),
      Icon: Megaphone,
      badgeCount: 0,
    },
    {
      href: "/admin/history",
      title: t("historyTitle"),
      desc: t("historyDesc"),
      Icon: History,
      badgeCount: 0,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ href, title, desc, Icon, badgeCount }) => (
          <Link key={href} href={href}>
            <Card className="relative h-full border-border transition hover:border-primary/40">
              {badgeCount > 0 ? (
                <span className="absolute right-4 top-4 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-[11px] font-bold text-primary-foreground">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
              <CardHeader>
                <Icon className="mb-2 h-8 w-8 text-primary opacity-90" />
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-primary">
                {t("open")}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
