"use client";

import { teacherSelfSignupAction } from "@/app/actions/teacher-signup";
import {
  initialTeacherSignupState,
  type TeacherSignupFormState,
} from "@/lib/teacher-signup-state";
import type { AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { useFormState } from "react-dom";
import { useState } from "react";

type Props = { locale: AppLocale };

export function TeacherSignupPanel({ locale }: Props) {
  const t = useTranslations("auth.signup");
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("auth.errors");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [state, formAction] = useFormState<
    TeacherSignupFormState,
    FormData
  >(teacherSelfSignupAction, initialTeacherSignupState);

  const errKey = state.errorCode;
  const message = errKey ? tErrors(errKey as never) : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      {message ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{message}</p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="signup-email">{t("email")}</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">{t("password")}</Label>
        <div className="relative">
          <Input
            id="signup-password"
            name="password"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            className="h-11 pr-11"
          />
          <button
            type="button"
            tabIndex={0}
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={showPw ? tAuth("hidePassword") : tAuth("showPassword")}
          >
            {showPw ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-confirm">{t("confirm")}</Label>
        <div className="relative">
          <Input
            id="signup-confirm"
            name="confirm"
            type={showPw2 ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            className="h-11 pr-11"
          />
          <button
            type="button"
            tabIndex={0}
            onClick={() => setShowPw2((v) => !v)}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={showPw2 ? tAuth("hidePassword") : tAuth("showPassword")}
          >
            {showPw2 ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
      <Button type="submit" className="h-11 w-full" size="lg">
        {t("submit")}
      </Button>
    </form>
  );
}
