"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { VoluntaryRecipientInvalidatedForUser } from "@/lib/data/teacher-voluntary-documents";

function dismissedStorageKey(idsFingerprint: string) {
  return `spor_voluntary_invalid_${idsFingerprint}`;
}

type Props = {
  items: VoluntaryRecipientInvalidatedForUser[];
};

export function VoluntaryDocumentInvalidatedDialog({ items }: Props) {
  const t = useTranslations("voluntaryDocuments");
  const [open, setOpen] = useState(false);

  const idsFingerprint = useMemo(
    () =>
      [...items]
        .map((i) => i.recipientId)
        .sort()
        .join(","),
    [items],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!idsFingerprint.length) {
      setOpen(false);
      return;
    }
    if (sessionStorage.getItem(dismissedStorageKey(idsFingerprint)) === "1") {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [idsFingerprint, items]);

  if (items.length === 0 || !idsFingerprint) return null;

  const persistDismiss = () => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(dismissedStorageKey(idsFingerprint), "1");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) persistDismiss();
      }}
    >
      <DialogContent className="max-w-lg gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("invalidModalTitle")}</DialogTitle>
          <DialogDescription className="leading-relaxed">{t("invalidModalIntro")}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {items.map((it) => (
            <li
              key={it.recipientId}
              className="rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 dark:border-rose-400/30 dark:bg-rose-950/40"
            >
              <p className="font-medium">{it.label}</p>
              {it.description ? <p className="text-muted-foreground">{it.description}</p> : null}
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:flex-col sm:items-stretch sm:justify-start sm:space-y-2 sm:gap-0">
          <Button type="button" variant="default" size="sm" className="w-full sm:w-auto" asChild>
            <Link
              href="/documents-volontaires"
              className="w-full justify-center text-center sm:w-auto"
              onClick={() => {
                persistDismiss();
                setOpen(false);
              }}
            >
              {t("invalidModalAttach")}
            </Link>
          </Button>
          <div className="flex flex-wrap justify-end gap-2 sm:w-full">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("invalidModalDismiss")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
