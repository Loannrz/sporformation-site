import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

export default async function AccessDeniedPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "errors",
  });

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <ShieldOff className="mb-4 h-14 w-14 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">{t("accessDeniedTitle")}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        {t("accessDeniedBody")}
      </p>
      <Button type="button" className="mt-8" asChild>
        <Link href="/dashboard">{t("backDashboard")}</Link>
      </Button>
    </div>
  );
}
