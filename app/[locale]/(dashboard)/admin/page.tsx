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
import { Users, School, GraduationCap, Megaphone, CalendarDays } from "lucide-react";

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

  const cards = [
    {
      href: "/administration/classes",
      title: t("classesTitle"),
      desc: t("classesDesc"),
      Icon: School,
    },
    {
      href: "/admin/users",
      title: t("usersTitle"),
      desc: t("usersDesc"),
      Icon: Users,
    },
    {
      href: "/admin/students",
      title: t("studentsTitle"),
      desc: t("studentsDesc"),
      Icon: GraduationCap,
    },
    {
      href: "/admin/calendar",
      title: t("calendarTitle"),
      desc: t("calendarDesc"),
      Icon: CalendarDays,
    },
    {
      href: "/admin/announcements",
      title: t("announcementsTitle"),
      desc: t("announcementsDesc"),
      Icon: Megaphone,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ href, title, desc, Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full border-border transition hover:border-primary/40">
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
