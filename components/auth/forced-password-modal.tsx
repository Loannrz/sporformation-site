"use client";

import { completeFirstPasswordSetupAction } from "@/app/actions/auth";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  mustSetPassword: boolean;
};

export function ForcedPasswordModal({ mustSetPassword }: Props) {
  const router = useRouter();
  const t = useTranslations("auth.firstPassword");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError(t("tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError(t("config"));
      return;
    }
    setPending(true);
    const { error: uErr } = await sb.auth.updateUser({ password });
    if (uErr) {
      setPending(false);
      setError(uErr.message);
      return;
    }
    const res = await completeFirstPasswordSetupAction();
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? t("generic"));
      return;
    }
    router.refresh();
  };

  return (
    <Dialog
      open={mustSetPassword}
      onOpenChange={() => {
        /* non fermable */
      }}
    >
      <DialogContent
        hideClose
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="fp-pw">{t("password")}</Label>
            <Input
              id="fp-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-pw2">{t("confirm")}</Label>
            <Input
              id="fp-pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              className="h-11"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={pending}
            onClick={submit}
          >
            {pending ? t("saving") : t("submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
