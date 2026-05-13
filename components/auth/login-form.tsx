"use client";

import { signInWithPasswordAction } from "@/app/actions/auth";
import { OtpLoginPanel } from "@/components/auth/otp-login-panel";
import {
  initialSignInState,
  type SignInFormState,
} from "@/lib/auth/sign-in-form-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppLocale } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { useFormState } from "react-dom";
import { useState } from "react";

type Props = { locale: AppLocale; urlErrorMessage?: string | null };

export function LoginForm({ locale, urlErrorMessage }: Props) {
  const t = useTranslations("auth");
  const tErrors = useTranslations("auth.errors");
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction] = useFormState<
    SignInFormState,
    FormData
  >(signInWithPasswordAction, initialSignInState);

  const mainMessage =
    state.errorCode != null ? tErrors(state.errorCode) : urlErrorMessage;

  return (
    <Tabs defaultValue="password" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="password">{t("tabPassword")}</TabsTrigger>
        <TabsTrigger value="otp">{t("tabOtp")}</TabsTrigger>
      </TabsList>
      <TabsContent value="password" className="mt-4 space-y-4 outline-none">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          {mainMessage ? (
            <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p>{mainMessage}</p>
              {state.devDetail ? (
                <p className="font-mono text-[11px] text-destructive/90 opacity-90">
                  {t("devDetailLabel")}: {state.devDetail}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="h-11 pr-11"
              />
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
          <Button type="submit" className="h-11 w-full" size="lg">
            {t("signIn")}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="otp" className="mt-4 outline-none">
        <OtpLoginPanel />
      </TabsContent>
    </Tabs>
  );
}
