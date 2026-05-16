"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import {
  submitTeacherDocumentsBundleAction,
  uploadTeacherDocumentRequestAction,
} from "@/app/actions/teacher-documents";
import { toast } from "sonner";

export type RequestRowUi = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  file_id: string | null;
  file_title: string | null;
};

type Props = {
  locale: AppLocale;
  requests: RequestRowUi[];
  bundleSubmittedAt: string | null;
};

export function TeacherDocumentsToProvidePanel({
  locale,
  requests,
  bundleSubmittedAt,
}: Props) {
  const t = useTranslations("teacherDocuments");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const allFilled = requests.length > 0 && requests.every((r) => r.file_id);
  const canSubmit =
    allFilled && !bundleSubmittedAt && requests.length > 0;

  const onFile = (requestId: string, file: File | null) => {
    if (!file) return;
    setUploadingId(requestId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("requestId", requestId);
      fd.set("file", file);
      const res = await uploadTeacherDocumentRequestAction(locale, fd);
      setUploadingId(null);
      if (res.ok) {
        toast.success(t("uploadSuccess"));
        router.refresh();
      } else {
        toast.error(t(`errors.${res.error}` as "errors.FILE_REQUIRED"));
      }
    });
  };

  const onSubmit = () => {
    startTransition(async () => {
      const res = await submitTeacherDocumentsBundleAction(locale);
      if (res.ok) {
        toast.success(t("submitSuccess"));
        router.refresh();
      } else {
        toast.error(t(`errors.${res.error}` as "errors.INCOMPLETE"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-lg shadow-black/[0.03] dark:shadow-black/30">
        <CardHeader className="px-5 sm:px-8 pt-6 sm:pt-8">
          <CardTitle className="text-2xl font-semibold">{t("title")}</CardTitle>
          <CardDescription className="text-base">{t("intro")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-5 pb-8 sm:px-8">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRequests")}</p>
          ) : (
            <ul className="space-y-5">
              {requests.map((r) => {
                const filled = Boolean(r.file_id);
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-xl border border-border/60 bg-muted/30 p-4 dark:bg-muted/20",
                      filled && "border-primary/25 bg-primary/[0.04]",
                    )}
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{r.label}</p>
                      {r.description ? (
                        <p className="text-sm text-muted-foreground">
                          {r.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`file-${r.id}`} className="text-xs">
                          {t("fileLabel")}
                        </Label>
                        <Input
                          id={`file-${r.id}`}
                          type="file"
                          accept="application/pdf,image/*,.doc,.docx"
                          disabled={pending || Boolean(bundleSubmittedAt)}
                          className="cursor-pointer"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            if (f) onFile(r.id, f);
                            e.target.value = "";
                          }}
                        />
                        {filled && r.file_title ? (
                          <p className="text-xs text-muted-foreground">
                            {t("currentFile", { name: r.file_title })}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right text-xs text-muted-foreground sm:min-w-[100px]">
                        {uploadingId === r.id
                          ? t("uploading")
                          : filled
                            ? t("statusOk")
                            : t("statusMissing")}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {bundleSubmittedAt ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              {t("submittedWaiting")}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={!canSubmit || pending}
              className={cn(
                "w-full sm:w-auto",
                canSubmit && "shadow-md shadow-destructive/25",
              )}
              onClick={onSubmit}
            >
              {t("submitButton")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
