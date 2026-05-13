"use client";

import { updateAnnouncementAdminAction } from "@/app/actions/announcements-admin";
import { AnnouncementLogoMark } from "@/components/announcements/announcement-logo-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Announcement, AnnouncementAudience } from "@/types";
import {
  ANNOUNCEMENT_ACCENT_KEYS,
  ANNOUNCEMENT_ACCENT_SWATCH,
  type AnnouncementAccentKey,
} from "@/lib/announcement-accents";
import { ANNOUNCEMENT_LOGO_IDS } from "@/lib/announcement-logos";
import { announcementHtmlToPlainDescription } from "@/lib/announcement-html";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useEffect, useId, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

const AUDIENCE_KEYS: AnnouncementAudience[] = [
  "ALL_STAFF",
  "CLASSROOM_TEACHERS",
  "HEAD_TEACHERS_ONLY",
  "DIRECTION_ONLY",
];

type Props = {
  locale: AppLocale;
  announcement: Announcement;
  onSaved: () => void;
};

export function EditAnnouncementForm({ locale, announcement, onSaved }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.publishAnnouncement");
  const tManage = useTranslations("announcements.manage");
  const uid = useId();
  const [title, setTitle] = useState(announcement.title);
  const [description, setDescription] = useState(
    announcementHtmlToPlainDescription(announcement.html),
  );
  const [logoKey, setLogoKey] =
    useState<(typeof ANNOUNCEMENT_LOGO_IDS)[number]>(
      (ANNOUNCEMENT_LOGO_IDS as readonly string[]).includes(announcement.logoKey)
        ? (announcement.logoKey as (typeof ANNOUNCEMENT_LOGO_IDS)[number])
        : "megaphone",
    );
  const [accentKey, setAccentKey] = useState<AnnouncementAccentKey>(
    (ANNOUNCEMENT_ACCENT_KEYS as readonly string[]).includes(
      announcement.accentKey ?? "",
    )
      ? (announcement.accentKey as AnnouncementAccentKey)
      : "slate",
  );
  const [audience, setAudience] = useState<AnnouncementAudience>(
    announcement.audience,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const radioName = `ann-edit-aud-${uid}`;

  useEffect(() => {
    setTitle(announcement.title);
    setDescription(announcementHtmlToPlainDescription(announcement.html));
    setLogoKey(
      (ANNOUNCEMENT_LOGO_IDS as readonly string[]).includes(announcement.logoKey)
        ? (announcement.logoKey as (typeof ANNOUNCEMENT_LOGO_IDS)[number])
        : "megaphone",
    );
    setAccentKey(
      (ANNOUNCEMENT_ACCENT_KEYS as readonly string[]).includes(
        announcement.accentKey ?? "",
      )
        ? (announcement.accentKey as AnnouncementAccentKey)
        : "slate",
    );
    setAudience(announcement.audience);
    setError(null);
  }, [announcement]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateAnnouncementAdminAction(locale, announcement.id, {
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
        if (res.error === "NOT_FOUND") {
          toast.error(tManage("goneToast"));
          onSaved();
          router.refresh();
          return;
        }
        if (res.error === "UPDATE_FAILED") {
          toast.error(tManage("updateFailedToast"));
          return;
        }
        toast.error(t("errorGeneric"));
        return;
      }
      toast.success(tManage("updatedToast"));
      onSaved();
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={`ed-title-${uid}`}>{t("titleLabel")}</Label>
        <Input
          id={`ed-title-${uid}`}
          value={title}
          maxLength={200}
          onChange={(ev) => setTitle(ev.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`ed-desc-${uid}`}>{t("descLabel")}</Label>
        <Textarea
          id={`ed-desc-${uid}`}
          value={description}
          onChange={(ev) => setDescription(ev.target.value)}
          rows={5}
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
              aria-pressed={logoKey === id}
            >
              <AnnouncementLogoMark logoKey={id} variant="lg" accentKey={accentKey} />
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
                aria-pressed={accentKey === id}
              >
                <span className={cn("h-7 w-7 rounded-full", sw.dot)} />
              </button>
            );
          })}
        </div>
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
        {pending ? t("submitting") : tManage("saveChanges")}
      </Button>
    </form>
  );
}
