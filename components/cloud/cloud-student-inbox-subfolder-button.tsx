"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createStudentInboxSubfolderAction } from "@/app/actions/class-cloud-folders";
import type { AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  locale: AppLocale;
  classId: string;
  parentFolderId: string;
};

export function CloudStudentInboxSubfolderButton({
  locale,
  classId,
  parentFolderId,
}: Props) {
  const t = useTranslations("cloud");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    startTransition(async () => {
      const res = await createStudentInboxSubfolderAction(locale, {
        classId,
        parentFolderId,
        name: n,
      });
      if (!res.ok) {
        toast.error(t(`studentSubfolderError_${res.error}`));
        return;
      }
      toast.success(t("studentSubfolderSuccess"));
      setName("");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-2">
          <FolderPlus className="h-4 w-4" />
          {t("studentSubfolderTrigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border/80 bg-card/95 shadow-lg sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("studentSubfolderTitle")}</DialogTitle>
          <DialogDescription>{t("studentSubfolderHint")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="stu-subfolder-name">{t("studentSubfolderName")}</Label>
            <Input
              id="stu-subfolder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("studentSubfolderNamePlaceholder")}
              disabled={pending}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("uploadCancel")}
            </Button>
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? t("uploadSubmitting") : t("studentSubfolderSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
