"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCloudDocumentsByOwnerAction } from "@/app/actions/cloud-files";
import type { AppLocale } from "@/i18n/routing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Props = {
  locale: AppLocale;
  ownerId: string;
  teacherFolderLabel: string;
  fileCount: number;
};

export function CloudDeleteTeacherFolderButton({
  locale,
  ownerId,
  teacherFolderLabel,
  fileCount,
}: Props) {
  const t = useTranslations("cloud");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const res = await deleteCloudDocumentsByOwnerAction(locale, ownerId);
      if (res.ok) {
        toast.success(
          t("deleteTeacherFolderSuccess", { count: res.deleted }),
        );
        setOpen(false);
        router.refresh();
        return;
      }
      if (res.error === "FORBIDDEN") {
        toast.error(t("deleteFileErrorForbidden"));
      } else {
        toast.error(t("deleteTeacherFolderErrorGeneric"));
      }
    });
  };

  if (fileCount <= 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {t("deleteTeacherFolder")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTeacherFolderDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteTeacherFolderDialogDesc", {
              name: teacherFolderLabel,
              count: fileCount,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("deleteFileCancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? t("deleteFilePending") : t("deleteTeacherFolderConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
