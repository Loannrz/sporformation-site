"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import {
  addTeacherDocumentRequestAction,
  removeTeacherDocumentRequestAction,
} from "@/app/actions/teacher-documents";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import type { UserRole } from "@/types";

const nativeSelectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
    </section>
  );
}
