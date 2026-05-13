"use client";

import { CreateAnnouncementPanel } from "@/components/admin/create-announcement-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppLocale } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  locale: AppLocale;
};

/** Bouton dans l’en-tête → formulaire nouvelle annonce uniquement après ouverture. */
export function PublishAnnouncementDialog({ locale }: Props) {
  const [open, setOpen] = useState(false);
  const tManage = useTranslations("announcements.manage");

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        {tManage("publishButton")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tManage("publishDialogTitle")}</DialogTitle>
            <DialogDescription>
              {tManage("publishDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <CreateAnnouncementPanel
            locale={locale}
            embedded
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
