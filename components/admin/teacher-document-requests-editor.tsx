"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppLocale } from "@/i18n/routing";
import {
  addTeacherDocumentRequestAction,
  getTeacherDocumentRequestSignedUrlAction,
  removeTeacherDocumentRequestAction,
} from "@/app/actions/teacher-documents";
import { toast } from "sonner";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import type { UserRole } from "@/types";

const nativeSelectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function canInlinePreview(mime: string | null): boolean {
  if (!mime) return false;
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  if (mime.startsWith("text/")) return true;
  return false;
}

export type RequestLine = {
  id: string;
  label: string;
  file_id: string | null;
};

export type TemplateOption = { id: string; label: string };

type Props = {
  locale: AppLocale;
  teacherProfileId: string;
  viewerRole: UserRole;
  canManageAccounts: boolean;
  /** Compte validé : lecture seule. */
  documentsApproved: boolean;
  requests: RequestLine[];
  templates: TemplateOption[];
};

export function TeacherDocumentRequestsEditor({
  locale,
  teacherProfileId,
  viewerRole,
  canManageAccounts,
  documentsApproved,
  requests,
  templates,
}: Props) {
  const t = useTranslations("admin.teacherDocuments");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState<string>("");
  const [customLabel, setCustomLabel] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [previewPayload, setPreviewPayload] = useState<{
    url: string;
    title: string;
    mime: string | null;
  } | null>(null);
  const [fileActionBusyId, setFileActionBusyId] = useState<string | null>(null);

  const canEdit =
    canManageAccounts &&
    !documentsApproved &&
    (viewerRole === "DIRECTEUR" ||
      viewerRole === "ADMINISTRATEUR" ||
      viewerRole === "PEDAGO");

  const addRequest = () => {
    startTransition(async () => {
      const tpl =
        templateId && templateId !== "__custom__" && templateId !== ""
          ? templateId
          : null;
      const custom =
        templateId === "__custom__"
          ? customLabel.trim()
          : !tpl
            ? customLabel.trim()
            : undefined;
      if (!tpl && !custom) {
        toast.error(t("toastError"));
        return;
      }
      const res = await addTeacherDocumentRequestAction(locale, {
        teacherProfileId,
        templateId: tpl,
        customLabel: custom || undefined,
      });
      if (res.ok) {
        toast.success(t("toastSaved"));
        setCustomLabel("");
        setTemplateId("");
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const remove = (requestId: string) => {
    startTransition(async () => {
      const res = await removeTeacherDocumentRequestAction(
        locale,
        requestId,
        teacherProfileId,
      );
      if (res.ok) {
        toast.success(t("toastDeleted"));
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const fetchSignedUrl = async (requestId: string) => {
    const res = await getTeacherDocumentRequestSignedUrlAction(locale, {
      requestId,
      teacherProfileId,
    });
    if (!res.ok) {
      toast.error(t("toastError"));
      return null;
    }
    return res;
  };

  const openPreview = async (requestId: string) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewLoadingId(requestId);
    setPreviewPayload(null);
    const data = await fetchSignedUrl(requestId);
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

  const downloadFile = async (requestId: string) => {
    setFileActionBusyId(`dl:${requestId}`);
    const data = await fetchSignedUrl(requestId);
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

  if (!canEdit && requests.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border/70 bg-muted/20 p-5 sm:p-6 shadow-sm ring-1 ring-black/[0.03] dark:bg-muted/15 dark:ring-white/[0.04]">
      <div className="flex gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{t("teacherPanelTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("teacherPanelHint")}</p>
        </div>
      </div>

      {requests.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
            >
              <span>
                {r.label}
                {r.file_id ? (
                  <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                    ✓
                  </span>
                ) : null}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {r.file_id ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!!fileActionBusyId || !!previewLoadingId}
                      onClick={() => openPreview(r.id)}
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
                      className="gap-1.5"
                      disabled={!!fileActionBusyId || !!previewLoadingId}
                      onClick={() => downloadFile(r.id)}
                    >
                      {fileActionBusyId === `dl:${r.id}` ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Download className="size-4" aria-hidden />
                      )}
                      {t("downloadDocument")}
                    </Button>
                  </>
                ) : null}
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                  >
                    {t("removeRequest")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}

      {canEdit ? (
        <div className="space-y-4 border-t border-border/60 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-pick">{t("selectTemplate")}</Label>
              <select
                id="tpl-pick"
                className={nativeSelectClass}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={pending}
              >
                <option value="">{t("addFromTemplate")}</option>
                <option value="__custom__">{t("addCustomLabel")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-doc-label">{t("addCustomLabel")}</Label>
              <Input
                id="custom-doc-label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder={t("templateLabel")}
                disabled={pending}
              />
            </div>
          </div>
          <Button type="button" onClick={addRequest} disabled={pending}>
            {t("addRequestSubmit")}
          </Button>
        </div>
      ) : null}

      {documentsApproved ? (
        <p className="text-xs text-muted-foreground">{t("stateApproved")}</p>
      ) : null}

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
                <a href={previewPayload.url} download={previewPayload.title} target="_blank" rel="noreferrer">
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
