"use client";

import { createAnnouncementAdminAction } from "@/app/actions/announcements-admin";
import { AnnouncementLogoMark } from "@/components/announcements/announcement-logo-mark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AnnouncementAudience } from "@/types";
import {
  ANNOUNCEMENT_ACCENT_KEYS,
  ANNOUNCEMENT_ACCENT_SWATCH,
  type AnnouncementAccentKey,
} from "@/lib/announcement-accents";
import { ANNOUNCEMENT_LOGO_IDS } from "@/lib/announcement-logos";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useState, useTransition, useId, type FormEvent } from "react";
import { toast } from "sonner";

type Props = {
  locale: AppLocale;
  embedded?: boolean;
  onSuccess?: () => void;
};

const AUDIENCE_KEYS: AnnouncementAudience[] = [
  "ALL_STAFF",
  "CLASSROOM_TEACHERS",
  "HEAD_TEACHERS_ONLY",
  "DIRECTION_ONLY",
];

export function CreateAnnouncementPanel({
  locale,
  embedded = false,
  onSuccess,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin.publishAnnouncement");
  const uid = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoKey, setLogoKey] =
    useState<(typeof ANNOUNCEMENT_LOGO_IDS)[number]>("megaphone");
  const [accentKey, setAccentKey] =
    useState<AnnouncementAccentKey>("slate");
  const [audience, setAudience] =
    useState<AnnouncementAudience>("ALL_STAFF");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const radioName = `ann-audience-${uid}`;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createAnnouncementAdminAction(locale, {
        title,
        description,
        logoKey,
        audience,
        accentKey,
      });
      if (!res.ok) {
        if (res.error === "TITLE_REQUIRED") {
          setError(t("errorTitle"));
          return;
        }
        if (res.error === "DESCRIPTION_REQUIRED") {
          setError(t("errorDesc"));
          return;
        }
        if (res.error === "FORBIDDEN") {
          toast.error(t("errorForbidden"));
          return;
        }
        if (res.error === "NO_SERVICE_ROLE") {
          toast.error(t("errorService"));
          return;
        }
        if (res.error === "INSERT_FAILED") {
          toast.error(t("errorInsert"));
          return;
        }
        toast.error(t("errorGeneric"));
        return;
      }
      toast.success(t("successToast"));
      setTitle("");
      setDescription("");
      setAudience("ALL_STAFF");
      setLogoKey("megaphone");
      setAccentKey("slate");
      onSuccess?.();
      router.refresh();
    });
  };

  const formBody = (
    <>
      <div className="space-y-2">
        <Label htmlFor={`an-title-${uid}`}>{t("titleLabel")}</Label>
        <Input
          id={`an-title-${uid}`}
          value={title}
          maxLength={200}
          onChange={(ev) => setTitle(ev.target.value)}
          placeholder={t("titlePlaceholder")}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`an-desc-${uid}`}>{t("descLabel")}</Label>
        <Textarea
          id={`an-desc-${uid}`}
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          rows={5}
          placeholder={t("descPlaceholder")}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("logoLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {ANNOUNCEMENT_LOGO_IDS.map((id) => (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={() => setLogoKey(id)}
              className={cn(
                "rounded-xl border bg-card p-1 transition hover:border-primary/50",
                logoKey === id
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border",
              )}
              title={t(`logos.${id}`)}
              aria-label={t(`logos.${id}`)}
              aria-pressed={logoKey === id}
            >
              <AnnouncementLogoMark logoKey={id} variant="lg" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("accentLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {ANNOUNCEMENT_ACCENT_KEYS.map((id) => {
            const sw = ANNOUNCEMENT_ACCENT_SWATCH[id];
            return (
              <button
                key={id}
                type="button"
                disabled={pending}
                onClick={() => setAccentKey(id)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card p-0.5 shadow-sm transition",
                  accentKey === id
                    ? cn("ring-2 ring-offset-2 ring-offset-background", sw.ring)
                    : "hover:opacity-90",
                )}
                title={t(`accents.${id}`)}
                aria-label={t(`accents.${id}`)}
                aria-pressed={accentKey === id}
              >
                <span className={cn("h-7 w-7 rounded-full", sw.dot)} />
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("accentHint")}</p>
      </div>

      <div className="space-y-2">
        <Label>{t("audienceLabel")}</Label>
        <div className="grid gap-2">
          {AUDIENCE_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted/40"
            >
              <input
                type="radio"
                name={radioName}
                className="mt-1"
                checked={audience === key}
                onChange={() => setAudience(key)}
                disabled={pending}
              />
              <span>
                <span className="font-medium">{t(`aud.${key}`)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(`audHint.${key}`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </>
  );

  if (embedded) {
    return (
      <form onSubmit={onSubmit} className="space-y-6">
        {formBody}
      </form>
    );
  }

  return (
    <Card className="max-w-xl border-border">
      <CardHeader>
        <CardTitle>{t("formTitle")}</CardTitle>
        <CardDescription>{t("formSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {formBody}
        </form>
      </CardContent>
    </Card>
  );
}
