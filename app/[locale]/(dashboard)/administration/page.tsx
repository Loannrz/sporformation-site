import { Link, redirect } from "@/i18n/navigation";
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
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdministrationHomePage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();

  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  if (!isDirector(user)) {
    redirect({ href: "/admin", locale: params.locale });
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });

  const links = [
    { href: "/administration/roles", label: t("rolesTitle") },
    { href: "/administration/comptes", label: t("accountsTitle") },
    { href: "/administration/classes", label: t("classesTitle") },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="h-full border-border transition hover:border-primary/40">
              <CardHeader>
                <CardTitle className="text-lg">{l.label}</CardTitle>
                <CardDescription>{t("orgHint")}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-primary">
                Ouvrir →
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
