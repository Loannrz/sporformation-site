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
import { uploadVoluntaryDocumentRecipientAction } from "@/app/actions/teacher-voluntary-documents";
import { toast } from "sonner";

export type VoluntaryRequestRowUi = {
  recipientId: string;
  requestId: string;
  label: string;
  description: string | null;
  file_id: string | null;
  file_title: string | null;
  needsReuploadDueToInvalidation: boolean;
};

type Props = {
  locale: AppLocale;
  requests: VoluntaryRequestRowUi[];
  pendingCount: number;
};

export function TeacherVoluntaryDocumentsPanel({
  locale,
  requests,
  pendingCount,
}: Props) {
  const t = useTranslations("voluntaryDocuments");
  const router = useRouter();
  const [pendingTr, startTransition] = useTransition();
  const [draftFiles, setDraftFiles] = useState<Partial<Record<string, File>>>({});
  const [inputKeys, setInputKeys] = useState<Record<string, number>>({});
  const [busyRecipientId, setBusyRecipientId] = useState<string | null>(null);

  const bumpInputKey = (recipientId: string) => {
    setInputKeys((prev) => ({ ...prev, [recipientId]: (prev[recipientId] ?? 0) + 1 }));
  };

  const setDraftFor = (recipientId: string, file: File | null) => {
    setDraftFiles((prev) => {
      const next = { ...prev };
      if (!file) delete next[recipientId];
      else next[recipientId] = file;
      return next;
    });
  };

  const onPickFile = (recipientId: string, file: File | null) => {
    if (!file || file.size === 0) {
      setDraftFor(recipientId, null);
      return;
    }
    setDraftFor(recipientId, file);
  };

  const clearDraftOnly = (recipientId: string) => {
    setDraftFor(recipientId, null);
    bumpInputKey(recipientId);
  };

  const submitDraft = (recipientId: string) => {
    const file = draftFiles[recipientId];
    if (!(file instanceof File) || file.size === 0) {
      toast.error(t("errors.FILE_REQUIRED"));
      return;
    }
    setBusyRecipientId(recipientId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("recipientId", recipientId);
      fd.set("file", file);
      const res = await uploadVoluntaryDocumentRecipientAction(locale, fd);
      setBusyRecipientId(null);
      if (res.ok) {
        toast.success(t("uploadSuccess"));
        setDraftFor(recipientId, null);
        bumpInputKey(recipientId);
        router.refresh();
      } else {
        toast.error(t(`errors.${res.error}` as "errors.FILE_REQUIRED"));
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="border-border/70 shadow-lg shadow-black/[0.03] dark:shadow-black/30">
        <CardHeader className="px-5 sm:px-8 pt-6 sm:pt-8">
          <CardTitle className="text-2xl font-semibold">{t("pageTitle")}</CardTitle>
          <CardDescription className="text-base">{t("pageIntro")}</CardDescription>
          {pendingCount > 0 ? (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t("pendingSummary", { count: pendingCount })}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6 px-5 pb-8 sm:px-8">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noOpenRequests")}</p>
          ) : (
            <ul className="space-y-5">
              {requests.map((r) => {
                const submitted = Boolean(r.file_id);
                const draft = draftFiles[r.recipientId];
                const hasDraft = Boolean(draft);
                const inputKeyNum = inputKeys[r.recipientId] ?? 0;
                const showBusy = pendingTr && busyRecipientId === r.recipientId;

                return (
                  <li
                    key={r.recipientId}
                    className={cn(
                      "rounded-xl border border-border/60 bg-muted/30 p-4 dark:bg-muted/20",
                      submitted && "border-primary/25 bg-primary/[0.04]",
                      r.needsReuploadDueToInvalidation && !submitted && "border-rose-400/35 bg-rose-500/[0.06]",
                    )}
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{r.label}</p>
                      {r.description ? (
                        <p className="text-sm text-muted-foreground">{r.description}</p>
                      ) : null}
                      {r.needsReuploadDueToInvalidation && !submitted ? (
                        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                          {t("invalidCardHint")}
                        </p>
                      ) : null}
                      {submitted && r.file_title ? (
                        <p className="text-xs text-muted-foreground">
                          {t("currentFile", { name: r.file_title })}
                        </p>
                      ) : null}
                      {!submitted && hasDraft ? (
                        <p className="text-xs text-muted-foreground">
                          {t("draftSelectedFile", { name: draft!.name })}
                        </p>
                      ) : null}
                    </div>
                    {!submitted ? (
                      <div className="mt-4 flex flex-col gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`vfile-${r.recipientId}`} className="text-xs">
                            {t("fileLabel")}
                          </Label>
                          <Input
                            key={`${r.recipientId}-${inputKeyNum}`}
                            id={`vfile-${r.recipientId}`}
                            type="file"
                            disabled={showBusy}
                            onChange={(e) => onPickFile(r.recipientId, e.target.files?.[0] ?? null)}
                            className="cursor-pointer text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={showBusy || !hasDraft}
                            onClick={() => submitDraft(r.recipientId)}
                          >
                            {t("submitDocument")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={showBusy || !hasDraft}
                            onClick={() => clearDraftOnly(r.recipientId)}
                          >
                            {t("removeDraftFile")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" disabled>
                          {t("statusOk")}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
