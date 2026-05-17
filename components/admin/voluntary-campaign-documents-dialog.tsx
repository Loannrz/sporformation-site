"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AppLocale } from "@/i18n/routing";
import {
  invalidateVoluntaryDocumentRecipientAction,
  excuseVoluntaryDocumentRecipientAction,
  getTeacherVoluntaryRecipientSignedUrlAction,
  listVoluntaryRecipientsForRequestAction,
} from "@/app/actions/teacher-voluntary-documents";
import type { VoluntaryRecipientRowForCampaign } from "@/lib/data/teacher-voluntary-documents";
import { toast } from "sonner";
import { Download, Eye, FileX, Loader2, UserMinus } from "lucide-react";

function canInlinePreview(mime: string | null): boolean {
  if (!mime) return false;
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  if (mime.startsWith("text/")) return true;
  return false;
}

type Props = {
  locale: AppLocale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignLabel: string;
  requestId: string | null;
};

export function VoluntaryCampaignDocumentsDialog({
  locale,
  open,
  onOpenChange,
  campaignLabel,
  requestId,
}: Props) {
  const t = useTranslations("admin.teacherDocuments");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<VoluntaryRecipientRowForCampaign[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewPayload, setPreviewPayload] = useState<{
    url: string;
    title: string;
    mime: string | null;
  } | null>(null);
  const [fileActionBusyId, setFileActionBusyId] = useState<string | null>(null);
  const [confirmInvalidateRecipientId, setConfirmInvalidateRecipientId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!requestId) {
      setRows([]);
      return;
    }
    startTransition(async () => {
      const res = await listVoluntaryRecipientsForRequestAction(locale, requestId);
      if (res.ok) setRows(res.rows);
      else toast.error(t("toastError"));
    });
  }, [locale, requestId, t]);

  useEffect(() => {
    if (open && requestId) {
      reload();
    } else if (!open) {
      setRows([]);
    }
  }, [open, requestId, reload]);

  const fetchSignedUrl = async (recipientId: string, teacherProfileId: string) => {
    const res = await getTeacherVoluntaryRecipientSignedUrlAction(locale, {
      recipientId,
      teacherProfileId,
    });
    if (!res.ok) {
      toast.error(t("toastError"));
      return null;
    }
    return res;
  };

  const openPreview = async (recipientId: string, teacherProfileId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewLoadingId(recipientId);
    setPreviewPayload(null);
    const data = await fetchSignedUrl(recipientId, teacherProfileId);
    setPreviewLoading(false);
    setPreviewLoadingId(null);
    if (!data) {
      setPreviewOpen(false);
      return;
    }
    setPreviewPayload({
      url: data.signedUrl,
      title: data.title,
      mime: data.mime,
    });
  };

  const downloadFile = async (recipientId: string, teacherProfileId: string) => {
    setFileActionBusyId(`dl:${recipientId}`);
    const data = await fetchSignedUrl(recipientId, teacherProfileId);
    setFileActionBusyId(null);
    if (!data) return;
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = data.title || "document";
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const excuse = (recipientId: string) => {
    startTransition(async () => {
      const res = await excuseVoluntaryDocumentRecipientAction(locale, recipientId);
      if (res.ok) {
        toast.success(t("voluntaryExcuseToast"));
        reload();
        router.refresh();
      } else if (res.error === "ALREADY_EXCUSED") {
        toast.error(t("voluntaryExcuseAlready"));
      } else if (res.error === "INVALID_STATE") {
        toast.error(t("voluntaryExcuseInvalid"));
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const invalidate = (recipientId: string) => {
    setConfirmInvalidateRecipientId(null);
    startTransition(async () => {
      const res = await invalidateVoluntaryDocumentRecipientAction(locale, recipientId);
      if (res.ok) {
        toast.success(t("voluntaryInvalidateToast"));
        reload();
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-4 overflow-hidden p-5 sm:max-w-2xl sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("voluntaryCampaignDialogTitle")}</DialogTitle>
            <DialogDescription className="leading-relaxed">{campaignLabel}</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto">
            {pending && rows.length === 0 ? (
              <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
                {t("voluntaryCampaignDialogLoading")}
              </p>
            ) : rows.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">{t("voluntaryCampaignDialogEmpty")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {rows.map((r) => {
                  const excused = Boolean(r.admin_excused_at);
                  const deposited = Boolean(r.file_id);
                  const needsResend = Boolean(r.voluntary_invalidated_at) && !deposited;
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium leading-snug">
                          {r.first_name} {r.last_name}
                          {r.email ? (
                            <span className="block truncate text-muted-foreground">· {r.email}</span>
                          ) : null}
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {excused ? (
                            <Badge
                              variant="outline"
                              className="border-violet-500/35 bg-violet-500/10 text-xs text-violet-900 dark:text-violet-200"
                            >
                              {t("voluntaryExcusedBadge")}
                            </Badge>
                          ) : deposited ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            >
                              {t("voluntaryDeposited")}
                            </Badge>
                          ) : needsResend ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 bg-amber-500/15 text-xs text-amber-900 dark:text-amber-200"
                            >
                              {t("voluntaryResendRequiredBadge")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {t("voluntaryPending")}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full shrink-0 flex-col items-stretch gap-1.5 sm:w-auto sm:min-w-[8.75rem]">
                        {deposited ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={!!fileActionBusyId || !!previewLoadingId}
                              onClick={() => openPreview(r.id, r.teacher_profile_id)}
                            >
                              {previewLoadingId === r.id ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <Eye className="size-4" aria-hidden />
                              )}
                              {t("previewDocument")}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="gap-1"
                              disabled={!!fileActionBusyId || !!previewLoadingId}
                              onClick={() => downloadFile(r.id, r.teacher_profile_id)}
                            >
                              {fileActionBusyId === `dl:${r.id}` ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                              ) : (
                                <Download className="size-4" aria-hidden />
                              )}
                              {t("downloadDocument")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                              disabled={pending}
                              onClick={() => setConfirmInvalidateRecipientId(r.id)}
                            >
                              <FileX className="size-4 shrink-0" aria-hidden />
                              {t("voluntaryInvalidateButton")}
                            </Button>
                          </>
                        ) : (
                          <>
                            {!excused ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={pending}
                                onClick={() => excuse(r.id)}
                              >
                                <UserMinus className="size-4" aria-hidden />
                                {t("voluntaryExcuseButton")}
                              </Button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("voluntaryCampaignDialogClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmInvalidateRecipientId !== null}
        onOpenChange={(next) => !next && !pending && setConfirmInvalidateRecipientId(null)}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voluntaryInvalidateConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voluntaryInvalidateConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancelEdit")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmInvalidateRecipientId) invalidate(confirmInvalidateRecipientId);
              }}
            >
              {t("voluntaryInvalidateConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={previewOpen}
        onOpenChange={(nextOpen) => {
          setPreviewOpen(nextOpen);
          if (!nextOpen) {
            setPreviewPayload(null);
            setPreviewLoading(false);
            setPreviewLoadingId(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-4xl w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("previewDialogTitle")}</DialogTitle>
          </DialogHeader>

          <div className="min-h-[200px] flex-1 overflow-auto rounded-lg border border-border/70 bg-muted/20">
            {previewLoading ? (
              <div className="flex h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                {t("previewLoading")}
              </div>
            ) : previewPayload && canInlinePreview(previewPayload.mime) ? (
              previewPayload.mime?.startsWith("image/") ? (
                <img
                  src={previewPayload.url}
                  alt={previewPayload.title}
                  className="mx-auto max-h-[min(75vh,720px)] w-auto max-w-full object-contain"
                />
              ) : (
                <iframe
                  title={previewPayload.title}
                  src={previewPayload.url}
                  className="h-[min(75vh,720px)] w-full border-0 bg-background"
                />
              )
            ) : previewPayload ? (
              <div className="flex flex-col gap-4 p-6 text-sm text-muted-foreground">
                <p>{t("previewUnsupported")}</p>
                <Button variant="outline" size="sm" className="w-fit gap-2" asChild>
                  <a href={previewPayload.url} target="_blank" rel="noreferrer">
                    {t("openInNewTab")}
                  </a>
                </Button>
              </div>
            ) : null}
          </div>

          {previewPayload ? (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="secondary" size="sm" className="gap-2" asChild>
                <a href={previewPayload.url} download={previewPayload.title} target="_blank" rel="noreferrer">
                  <Download className="size-4" aria-hidden />
                  {t("downloadDocument")}
                </a>
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
