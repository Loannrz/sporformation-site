"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppLocale } from "@/i18n/routing";
import { getTeacherVoluntaryRecipientSignedUrlAction } from "@/app/actions/teacher-voluntary-documents";
import { toast } from "sonner";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import type { VoluntaryRecipientForTeacherProfileAdmin } from "@/lib/data/teacher-voluntary-documents";

function canInlinePreview(mime: string | null): boolean {
  if (!mime) return false;
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  if (mime.startsWith("text/")) return true;
  return false;
}

type Props = {
  locale: AppLocale;
  teacherProfileId: string;
  rows: VoluntaryRecipientForTeacherProfileAdmin[];
};

export function TeacherVoluntaryDocumentsAccountSection({
  locale,
  teacherProfileId,
  rows,
}: Props) {
  const t = useTranslations("admin.teacherDocuments");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewPayload, setPreviewPayload] = useState<{
    url: string;
    title: string;
    mime: string | null;
  } | null>(null);
  const [fileActionBusyId, setFileActionBusyId] = useState<string | null>(null);

  if (!rows.length) return null;

  const fetchSignedUrl = async (recipientId: string) => {
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

  const openPreview = async (recipientId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewLoadingId(recipientId);
    setPreviewPayload(null);
    const data = await fetchSignedUrl(recipientId);
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

  const downloadFile = async (recipientId: string) => {
    setFileActionBusyId(`dl:${recipientId}`);
    const data = await fetchSignedUrl(recipientId);
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

  return (
    <section className="space-y-5 rounded-2xl border border-border/70 bg-muted/20 p-5 sm:p-6 shadow-sm ring-1 ring-black/[0.03] dark:bg-muted/15 dark:ring-white/[0.04]">
      <div className="flex gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            {t("voluntaryAccountSectionTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("voluntaryAccountSectionHint")}
          </p>
        </div>
      </div>

      <ul className="space-y-2 text-sm">
        {rows.map((r) => (
          <li
            key={r.recipientId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium">{r.label}</span>
              <Badge variant="outline" className="text-xs font-normal">
                {r.campaignStatus === "open"
                  ? t("voluntaryCampaignOpenBadge")
                  : t("voluntaryCampaignClosedBadge")}
              </Badge>
              {r.admin_excused_at ? (
                <Badge
                  variant="outline"
                  className="border-violet-500/35 bg-violet-500/10 text-xs font-normal text-violet-900 dark:text-violet-200"
                >
                  {t("voluntaryExcusedBadge")}
                </Badge>
              ) : null}
              {r.file_id ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {r.file_id ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!!fileActionBusyId || !!previewLoadingId}
                    onClick={() => openPreview(r.recipientId)}
                  >
                    {previewLoadingId === r.recipientId ? (
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
                    className="gap-1.5"
                    disabled={!!fileActionBusyId || !!previewLoadingId}
                    onClick={() => downloadFile(r.recipientId)}
                  >
                    {fileActionBusyId === `dl:${r.recipientId}` ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )}
                    {t("downloadDocument")}
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("voluntaryNoFileYet")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
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
                <a
                  href={previewPayload.url}
                  download={previewPayload.title}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="size-4" aria-hidden />
                  {t("downloadDocument")}
                </a>
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
