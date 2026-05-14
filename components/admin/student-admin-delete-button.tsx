"use client";

import { deleteStudentSingleAction } from "@/app/actions/students-admin";
import type { AppLocale } from "@/i18n/routing";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  locale: AppLocale;
  studentId: string;
  studentDisplayName: string;
};

export function StudentAdminDeleteButton({
  locale,
  studentId,
  studentDisplayName,
}: Props) {
  const router = useRouter();
  const ts = useTranslations("admin.students");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const mapErr = (code: string) => {
    if (code === "FORBIDDEN") return ts("bulkDeleteErrorForbidden");
    if (code === "NO_SERVICE_ROLE") return ts("bulkDeleteErrorNoServiceRole");
    if (code === "NOT_FOUND") return ts("bulkDeleteErrorNotFound");
    return ts("bulkDeleteErrorGeneric");
  };

  const runDelete = () => {
    startTransition(async () => {
      const res = await deleteStudentSingleAction(locale, studentId);
      if (!res.ok) {
        toast.error(mapErr(String(res.error)));
        return;
      }
      toast.success(ts("deleteStudentSuccess"));
      if (res.authRemovalFailed != null && res.authRemovalFailed > 0) {
        toast.warning(ts("deleteStudentAuthPartial"));
      }
      setOpen(false);
      router.push("/admin/students");
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 rounded-xl border-destructive/45 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        {ts("deleteStudentButton")}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ts("deleteStudentConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block font-medium text-foreground">
                {studentDisplayName}
              </span>
              <span className="block">{ts("deleteStudentConfirmDescription")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {ts("deleteStudentCancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => runDelete()}
            >
              {pending ? ts("deleteStudentWorking") : ts("deleteStudentConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
