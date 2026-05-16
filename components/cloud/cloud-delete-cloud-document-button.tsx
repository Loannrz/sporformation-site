"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteCloudDocumentAction } from "@/app/actions/cloud-files";
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
import { cn } from "@/lib/utils";

type Props = {
  locale: AppLocale;
  fileId: string;
  fileTitle: string;
  folderSlug?: string | null;
  compact?: boolean;
  className?: string;
};

export function CloudDeleteCloudDocumentButton({
  locale,
  fileId,
  fileTitle,
  folderSlug = null,
  compact = false,
  className,
}: Props) {
  const t = useTranslations("cloud");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    startTransition(async () => {
      const res = await deleteCloudDocumentAction(locale, fileId, folderSlug);
      if (res.ok) {
        toast.success(t("deleteFileSuccess"));
        setOpen(false);
        router.refresh();
        return;
      }
      if (res.error === "FORBIDDEN") {
        toast.error(t("deleteFileErrorForbidden"));
      } else {
        toast.error(t("deleteFileErrorGeneric"));
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          variant="destructive"
          className={cn(compact && "h-8 w-8 shrink-0 p-0", className)}
          aria-label={t("deleteFileAria", { title: fileTitle })}
        >
          <Trash2 className={cn("h-4 w-4", !compact && "mr-1.5")} />
          {!compact ? t("deleteFile") : null}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteFileDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteFileDialogDesc", { title: fileTitle })}
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
            {pending ? t("deleteFilePending") : t("deleteFileConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
