"use client";

import { useEffect, useState } from "react";
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
import type { AppLocale } from "@/i18n/routing";
import type { VoluntaryRecipientPendingForUser } from "@/lib/data/teacher-voluntary-documents";

const SESSION_DISMISS_KEY = "spor_voluntary_doc_modal_dismissed";

type Props = {
  locale: AppLocale;
  items: VoluntaryRecipientPendingForUser[];
};

export function VoluntaryDocumentSessionDialog({ locale, items }: Props) {
  const t = useTranslations("voluntaryDocuments");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (items.length === 0) {
      setOpen(false);
      return;
    }
    if (sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && typeof window !== "undefined") {
          sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
        }
      }}
    >
      <DialogContent className="max-w-lg gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("modalTitle")}</DialogTitle>
          <DialogDescription>{t("modalIntro")}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {items.map((it) => (
            <li
              key={it.recipientId}
              className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
            >
              <p className="font-medium">{it.label}</p>
              {it.description ? (
                <p className="text-muted-foreground">{it.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:justify-between sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {t("modalLater")}
          </Button>
          <Button type="button" asChild>
            <Link href="/documents-volontaires">{t("modalCta")}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
