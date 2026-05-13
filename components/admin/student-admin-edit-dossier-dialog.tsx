"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { StudentAdminDetail } from "@/lib/data/students-admin";
import type { AdminClassOption } from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import { StudentAdminDetailForm } from "@/components/admin/student-admin-detail-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  locale: AppLocale;
  initial: StudentAdminDetail;
  classOptions: AdminClassOption[];
};

export function StudentAdminEditDossierDialog({
  locale,
  initial,
  classOptions,
}: Props) {
  const t = useTranslations("admin.students");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="default"
        className="shrink-0 gap-2"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4 opacity-90" />
        {t("editDossier")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,820px)] gap-4 overflow-y-auto border-border bg-card sm:max-w-2xl">
          <DialogHeader className="text-left">
            <DialogTitle>{t("editDossierDialogTitle")}</DialogTitle>
            <DialogDescription>{t("editDossierDialogHint")}</DialogDescription>
          </DialogHeader>
          <StudentAdminDetailForm
            locale={locale}
            initial={initial}
            classOptions={classOptions}
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
