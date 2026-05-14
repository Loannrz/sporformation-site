"use client";

import { useTransition, useRef, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { SessionUser } from "@/types";
import type { AppLocale } from "@/i18n/routing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { uploadMyAvatarAction } from "@/app/actions/profile-avatar";
import { toast } from "sonner";

const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  locale: AppLocale;
  user: SessionUser;
};

function initials(fn: string, ln: string) {
  return `${fn?.trim()?.[0] ?? ""}${ln?.trim()?.[0] ?? ""}`.toUpperCase() ||
    "?";
}

export function ProfileAvatarSettingsSection({ locale, user }: Props) {
  const t = useTranslations("settings.avatar");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open && fileRef.current) fileRef.current.value = "";
  }, [open]);

  const hasPhoto = Boolean(user.avatarUrl?.trim());

  const errLabel = (
    code: string,
    detail?: string,
  ): string => {
    const keys = [
      "NO_SESSION",
      "NO_DB",
      "NO_FILE",
      "FILE_TOO_LARGE",
      "INVALID_TYPE",
      "UPLOAD_FAILED",
      "SAVE_FAILED",
    ] as const;
    const map: Record<(typeof keys)[number], string> = {
      NO_SESSION: t("errors.NO_SESSION"),
      NO_DB: t("errors.NO_DB"),
      NO_FILE: t("errors.NO_FILE"),
      FILE_TOO_LARGE: t("errors.FILE_TOO_LARGE"),
      INVALID_TYPE: t("errors.INVALID_TYPE"),
      UPLOAD_FAILED: t("errors.UPLOAD_FAILED"),
      SAVE_FAILED: t("errors.SAVE_FAILED"),
    };
    const msg = keys.includes(code as (typeof keys)[number])
      ? map[code as keyof typeof map]
      : code;
    return detail ? `${msg} (${detail})` : msg;
  };

  const submitFile = (file: File | undefined) => {
    if (!file || pending) return;
    if (file.size > MAX_BYTES) {
      toast.error(errLabel("FILE_TOO_LARGE"));
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error(errLabel("INVALID_TYPE"));
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadMyAvatarAction(locale, fd);
      if (!res.ok) {
        toast.error(
          errLabel(res.error, "detail" in res ? res.detail : undefined),
        );
        return;
      }
      toast.success(t("success"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!hasPhoto) setOpen(true);
          }}
          aria-label={hasPhoto ? undefined : t("addPhotoAria")}
          title={hasPhoto ? undefined : t("addPhotoAria")}
          className={
            !hasPhoto
              ? "group relative shrink-0 cursor-pointer rounded-full ring-offset-2 transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              : "shrink-0 cursor-default rounded-full ring-offset-2"
          }
        >
          <Avatar className="h-20 w-20 border-2 border-muted shadow-sm transition group-hover:border-primary/45">
            {hasPhoto ? (
              <AvatarImage src={user.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/15 text-xl font-semibold text-primary">
              {initials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
          {!hasPhoto ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-foreground/0 text-xs font-semibold text-transparent transition group-hover:bg-foreground/10 group-hover:text-primary-foreground">
              +
            </span>
          ) : null}
        </button>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("label")}</p>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          {hasPhoto ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={pending}
              onClick={() => setOpen(true)}
            >
              {t("changePhoto")}
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="sf-avatar-file">{t("fileLabel")}</Label>
            <input
              id="sf-avatar-file"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={(e) => {
                submitFile(e.target.files?.[0]);
              }}
            />
            <p className="text-xs text-muted-foreground">{t("maxSize")}</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
