import { redirect } from "@/i18n/navigation";
import { signOutAction } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth/login-form";
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
import { getSupabaseConnectionConfig } from "@/lib/supabase/env";
import { getSessionUser } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";

function resolveLoginError(
  code: string | undefined,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (!code) return null;
  if (code === "config") return t("errorConfig");
  if (code === "badurl") return t("errorBadUrl");
  if (code === "need_profile") return t("errorNeedProfile");
  try {
    const decoded = decodeURIComponent(code);
    if (!decoded || decoded === "NEXT_REDIRECT") return t("errorGeneric");
    return decoded;
  } catch {
    return t("errorGeneric");
  }
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: { locale: AppLocale };
  searchParams?: { error?: string };
}) {
  const user = await getSessionUser();
  if (user) {
    redirect({ href: "/dashboard", locale: params.locale });
  }
  const t = await getTranslations({ locale: params.locale, namespace: "auth" });
  const errorMessage = resolveLoginError(searchParams?.error, t);
  const { url: sbUrl, anonKey: sbAnon } = getSupabaseConnectionConfig();
  const showEnvMissing = !sbUrl || !sbAnon;

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
            {showEnvMissing ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                {t("errorConfig")}
              </p>
            ) : null}

            <LoginForm locale={params.locale} urlErrorMessage={errorMessage} />

            {searchParams?.error === "need_profile" ? (
              <form action={signOutAction} className="flex justify-center">
                <input type="hidden" name="locale" value={params.locale} />
                <Button type="submit" variant="outline" size="sm">
                  {t("clearSession")}
                </Button>
              </form>
            ) : null}

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
