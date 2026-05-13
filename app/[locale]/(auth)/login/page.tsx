import { redirect } from "@/i18n/navigation";
import { devSignIn } from "@/app/actions/auth";
import { SporformationLogo } from "@/components/logo/sporformation-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AppLocale } from "@/i18n/routing";
import { readSessionCookie } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";

export default async function LoginPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await readSessionCookie();
  if (user) {
    redirect({ href: "/dashboard", locale: params.locale });
  }
  const t = await getTranslations({ locale: params.locale, namespace: "auth" });

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 gradient-mesh dark:gradient-mesh-dark" />
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-[0.99] duration-500">
        <div className="mb-10 flex justify-center">
          <SporformationLogo />
        </div>
        <Card className="glass border-white/45 dark:border-white/10">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {t("title")}
            </CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t("demoTitle")}</p>
              <p className="mt-1">{t("demoSubtitle")}</p>
            </div>

            <div className="grid gap-3">
              <form action={devSignIn} className="w-full">
                <input type="hidden" name="locale" value={params.locale} />
                <input type="hidden" name="role" value="DIRECTEUR" />
                <Button type="submit" className="h-11 w-full" size="lg">
                  {t("signInDirector")}
                </Button>
              </form>
              <form action={devSignIn} className="w-full">
                <input type="hidden" name="locale" value={params.locale} />
                <input type="hidden" name="role" value="PROF_PRINCIPAL" />
                <Button
                  type="submit"
                  variant="accent"
                  className="h-11 w-full"
                  size="lg"
                >
                  {t("signInPrincipal")}
                </Button>
              </form>
              <form action={devSignIn} className="w-full">
                <input type="hidden" name="locale" value={params.locale} />
                <input type="hidden" name="role" value="PROFESSEUR" />
                <Button
                  type="submit"
                  variant="secondary"
                  className="h-11 w-full"
                  size="lg"
                >
                  {t("signInTeacher")}
                </Button>
              </form>
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              {t("invitationNote")}
            </p>
          </CardContent>
        </Card>
        <p className="mt-10 text-center text-xs text-muted-foreground">
          {t("brandedFooter")}
        </p>
      </div>
    </div>
  );
}
