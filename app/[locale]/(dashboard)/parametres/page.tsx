import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ThemeToggleCards from "@/components/settings/theme-toggle-cards";

import { readSessionCookie } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function SettingsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await readSessionCookie();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "settings",
  });

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ThemeToggleCards />

      <Card className="border-dashed border-primary/35">
        <CardHeader>
          <CardTitle>Notifications email</CardTitle>
          <CardDescription>
            Digest messages & annonces configurables via ENV (voir README).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-8">
            <div>
              <Label htmlFor="digest">Résumés quotidiens</Label>
              <p className="text-xs text-muted-foreground">
                Simulés tant que aucun webhook Supabase branché.
              </p>
            </div>
            <Switch disabled id="digest" aria-label="daily digest toggle" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
