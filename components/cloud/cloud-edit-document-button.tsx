"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { updateCloudDocumentMetadataAction } from "@/app/actions/cloud-files";
import type {
  UpdateCloudDocumentMetadataErrorCode,
  UpdateCloudDocumentMetadataResult,
} from "@/lib/cloud-document-metadata";
import type { CloudStudentUploadOption } from "@/lib/data/school";
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
import { Textarea } from "@/components/ui/textarea";
import type { CloudDocumentAudience } from "@/lib/cloud-document-audience";
import type { CloudClassSelectOption } from "./cloud-upload-document-button";
import { CloudClassFolderPlacementPicker } from "@/components/cloud/cloud-class-folder-placement-picker";
import { CloudDocumentAudienceRadios } from "@/components/cloud/cloud-audience-ui";

export type CloudEditDocumentFileRef = {
  id: string;
  title: string;
  description: string;
  classId: string | null;
  studentId: string | null;
  classFolderId: string | null;
  cloudAudience: CloudDocumentAudience;
};

type FolderOptionsForClass = {
  classId: string;
  options: { id: string; label: string }[];
};

type Props = {
  locale: AppLocale;
  file: CloudEditDocumentFileRef;
  classOptions: CloudClassSelectOption[];
  studentOptions: CloudStudentUploadOption[];
  folderSlug?: string | null;
  folderOptionsForClass?: FolderOptionsForClass;
  /** Affichage compact (icône seule) dans les grilles. */
  compact?: boolean;
};

function errorMessageKey(code: UpdateCloudDocumentMetadataErrorCode): string {
  if (code === "STUDENT_UNKNOWN" || code === "STUDENT_CLASS_MISMATCH") {
    return `uploadError_${code}`;
  }
  if (code === "INVALID_AUDIENCE") {
    return "uploadError_INVALID_AUDIENCE";
  }
  return `editError_${code}`;
}

export function CloudEditDocumentButton({
  locale,
  file,
  classOptions,
  studentOptions,
  folderSlug = null,
  folderOptionsForClass,
  compact = false,
}: Props) {
  const t = useTranslations("cloud");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    file.classId ?? classOptions[0]?.id ?? null,
  );

  useEffect(() => {
    if (open) {
      setSelectedClassId(file.classId ?? classOptions[0]?.id ?? null);
    }
  }, [open, file.classId, classOptions]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={
            compact ? "h-8 shrink-0 gap-1 px-2 text-[11px]" : "mt-auto gap-1"
          }
          aria-label={t("editDocumentAria")}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {compact ? null : <span>{t("editDocumentButton")}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editDialogTitle")}</DialogTitle>
          <DialogDescription>{t("editDialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const form = e.currentTarget;
            const fd = new FormData(form);
            startTransition(async () => {
              const res: UpdateCloudDocumentMetadataResult =
                await updateCloudDocumentMetadataAction(locale, fd);
              if (res.ok === false) {
                const base = t(errorMessageKey(res.error));
                setError(
                  res.error === "UPDATE_FAILED" && res.detail
                    ? `${base} ${res.detail}`
                    : base,
                );
                return;
              }
              toast.success(t("editSuccess"));
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <input type="hidden" name="fileId" value={file.id} />
          {folderSlug ? (
            <input type="hidden" name="folderSlug" value={folderSlug} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`cloud-edit-title-${file.id}`}>
              {t("uploadFieldDocumentName")}
            </Label>
            <Input
              id={`cloud-edit-title-${file.id}`}
              name="title"
              required
              disabled={pending}
              defaultValue={file.title}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cloud-edit-desc-${file.id}`}>
              {t("editFieldDescription")}
            </Label>
            <Textarea
              id={`cloud-edit-desc-${file.id}`}
              name="description"
              disabled={pending}
              defaultValue={file.description}
              rows={3}
              className="resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`cloud-edit-class-${file.id}`}>
              {t("uploadFieldClass")}
            </Label>
            {classOptions.length === 0 ? (
              <p className="text-sm text-destructive">{t("uploadNoClassAvailable")}</p>
            ) : (
              <>
                <select
                  id={`cloud-edit-class-${file.id}`}
                  name="classId"
                  required
                  disabled={pending}
                  value={selectedClassId ?? classOptions[0]!.id}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {t("uploadClassRequiredStaff")}
                </p>
              </>
            )}
          </div>

          <CloudClassFolderPlacementPicker
            locale={locale}
            dialogOpen={open}
            selectedClassId={selectedClassId}
            seededFolderOptions={folderOptionsForClass}
            preferredFolderId={file.classFolderId ?? undefined}
            selectId={`cloud-edit-folder-${file.id}`}
            disabled={pending}
          />

          <div className="space-y-2">
            <Label htmlFor={`cloud-edit-student-${file.id}`}>
              {t("uploadFieldStudent")}
            </Label>
            <select
              id={`cloud-edit-student-${file.id}`}
              name="studentId"
              disabled={pending}
              defaultValue={file.studentId ?? "__none__"}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="__none__">{t("uploadNoStudent")}</option>
              {studentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {t("uploadFieldStudentHint").trim() ? (
              <p className="text-xs text-muted-foreground">{t("uploadFieldStudentHint")}</p>
            ) : null}
          </div>

          <CloudDocumentAudienceRadios
            disabled={pending}
            defaultValue={file.cloudAudience}
            fieldIdPrefix={`cloud-edit-audience-${file.id}`}
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("uploadCancel")}
            </Button>
            <Button type="submit" disabled={pending || classOptions.length === 0}>
              {pending ? t("editSubmitting") : t("editSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
