import { getTranslations } from "next-intl/server";
import { routing, type AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

type Props = {
  params?: { locale?: AppLocale };
};

export default async function NotFoundPage({ params }: Props) {
  const locale =
    params?.locale && routing.locales.includes(params.locale)
      ? params.locale
      : routing.defaultLocale;

  const t = await getTranslations({
    locale,
    namespace: "errors",
  });

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <FileQuestion className="mb-4 h-14 w-14 text-muted-foreground" />
      <h1 className="text-3xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("notFoundBody")}</p>
      <Button type="button" className="mt-8" asChild>
        <Link href="/dashboard">{t("backDashboard")}</Link>
      </Button>
    </div>
  );
}
