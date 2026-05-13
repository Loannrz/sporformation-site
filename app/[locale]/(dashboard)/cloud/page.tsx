import { getTranslations } from "next-intl/server";
import { CloudExplorer } from "@/components/cloud/cloud-explorer";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/session-server";

export default async function CloudPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "cloud",
  });

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-3xl font-semibold">{t("title")}</CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
      </Card>
      <CloudExplorer viewer={user} />
    </div>
  );
}
