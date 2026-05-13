"use client";

import { useRouter } from "@/i18n/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function OtpLoginPanel() {
  const router = useRouter();
  const t = useTranslations("auth.otp");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    setMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError(t("emailRequired"));
      return;
    }
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError(t("config"));
      return;
    }
    setPending(true);
    const { error: e } = await sb.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: false },
    });
    setPending(false);
    if (e) {
      setError(e.message);
      return;
    }
    setMessage(t("codeSent"));
    setStep("code");
  };

  const verifyCode = async () => {
    setError(null);
    setMessage(null);
    const trimmed = email.trim().toLowerCase();
    const token = code.replace(/\s/g, "");
    if (!token) {
      setError(t("codeRequired"));
      return;
    }
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError(t("config"));
      return;
    }
    setPending(true);
    const { error: e } = await sb.auth.verifyOtp({
      email: trimmed,
      token,
      type: "email",
    });
    setPending(false);
    if (e) {
      setError(e.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <div className="space-y-2">
        <Label htmlFor="otp-email">{t("email")}</Label>
        <Input
          id="otp-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={step === "code"}
          className="h-11"
        />
      </div>
      {step === "code" ? (
        <div className="space-y-2">
          <Label htmlFor="otp-code">{t("code")}</Label>
          <Input
            id="otp-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-11"
            placeholder="000000"
          />
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {step === "email" ? (
        <Button
          type="button"
          className="h-11 w-full"
          size="lg"
          disabled={pending}
          onClick={sendCode}
        >
          {pending ? t("sending") : t("sendCode")}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={pending}
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage(null);
              setError(null);
            }}
          >
            {t("changeEmail")}
          </Button>
          <Button
            type="button"
            className="h-11 flex-1"
            size="lg"
            disabled={pending}
            onClick={verifyCode}
          >
            {pending ? t("verifying") : t("verify")}
          </Button>
        </div>
      )}
    </div>
  );
}
