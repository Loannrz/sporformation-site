"use client";

import { useTranslations } from "next-intl";
import { ClipboardList, Eye, FileUp, School, Upload } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { uploadCloudDocumentAction } from "@/app/actions/cloud-files";
import type { CloudStudentUploadOption } from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
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
import { CloudClassFolderPlacementPicker } from "@/components/cloud/cloud-class-folder-placement-picker";
import { CloudDocumentAudienceRadios } from "@/components/cloud/cloud-audience-ui";

export type CloudClassSelectOption = { id: string; label: string };

type FolderOptionsForClass = {
  classId: string;
  options: { id: string; label: string }[];
};

type Props = {
  locale: AppLocale;
  viewer: { firstName: string; lastName: string };
  classOptions: CloudClassSelectOption[];
  studentOptions: CloudStudentUploadOption[];
  defaultClassId: string | null;
  defaultStudentId?: string | null;
  /** Segments bruts de l’URL dossier pour revalidation (ex. `classe-<uuid>`). */
  folderSlug?: string | null;
  /** Quand on envoie depuis l’espace d’une classe : liste des sous-dossiers pour cette classe. */
  folderOptionsForClass?: FolderOptionsForClass;
  /** `__root__` ou id de dossier ; utilisé avec `folderOptionsForClass`. */
  defaultClassFolderId?: string | null;
  /** Mode dépôt élève : classe et audience forcées, dossiers limités à l’inbox. */
  studentDeposit?: boolean;
  forcedClassId?: string | null;
  /** Overrides `folderOptionsForClass` en mode élève quand défini. */
  depositFolderPickOptions?: FolderOptionsForClass;
  depositButtonLabel?: string;
};

export function CloudUploadDocumentButton({
  locale,
  viewer,
  classOptions,
  studentOptions,
  defaultClassId,
  defaultStudentId = null,
  folderSlug = null,
  folderOptionsForClass,
  defaultClassFolderId = "__root__",
  studentDeposit = false,
  forcedClassId = null,
  depositFolderPickOptions,
  depositButtonLabel,
}: Props) {
  const t = useTranslations("cloud");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(() =>
    studentDeposit
      ? forcedClassId
      : defaultClassId ?? classOptions[0]?.id ?? null,
  );

  useEffect(() => {
    if (open) {
      setSelectedClassId(
        studentDeposit
          ? forcedClassId
          : defaultClassId ?? classOptions[0]?.id ?? null,
      );
    }
  }, [open, defaultClassId, forcedClassId, studentDeposit, classOptions]);

  const depositorLabel = `${viewer.firstName} ${viewer.lastName}`.trim();

  const seededForPicker =
    studentDeposit && depositFolderPickOptions
      ? depositFolderPickOptions
      : folderOptionsForClass;

  const pickerClassGate = studentDeposit ? forcedClassId : selectedClassId;

  const wizardSteps =
    studentDeposit
      ? [
          { Icon: FileUp, step: "uploadVisualStepAttachment" as const },
          { Icon: School, step: "uploadVisualStepPlacementStudent" as const },
          { Icon: ClipboardList, step: "uploadVisualStepDetails" as const },
        ]
      : [
          { Icon: FileUp, step: "uploadVisualStepAttachment" as const },
          { Icon: School, step: "uploadVisualStepClass" as const },
          { Icon: Eye, step: "uploadVisualStepVisibility" as const },
          { Icon: ClipboardList, step: "uploadVisualStepDetails" as const },
        ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-2">
          <Upload className="h-4 w-4" />
          {depositButtonLabel ?? t("uploadDocumentButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-border/80 bg-card/95 shadow-lg sm:max-w-lg">
        <DialogHeader className="space-y-4 text-center sm:text-left">
          <DialogTitle>
            {studentDeposit ? t("uploadDialogTitleStudent") : t("uploadDialogTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {studentDeposit
              ? t("uploadDialogAriaSummaryStudent")
              : t("uploadDialogAriaSummary")}
          </DialogDescription>
          <ol
            className={cn(
              "mx-auto grid w-full max-w-md list-none gap-2 p-0 sm:mx-0 sm:max-w-none",
              studentDeposit ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
            )}
            aria-hidden
          >
            {wizardSteps.map(({ Icon, step }, i) => (
              <li
                key={step}
                className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-2 py-3 text-center shadow-sm"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-primary shadow-inner ring-1 ring-border">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-medium leading-snug text-foreground">
                  {t(step)}
                </span>
              </li>
            ))}
          </ol>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const form = e.currentTarget;
            const fd = new FormData(form);
            startTransition(async () => {
              const res = await uploadCloudDocumentAction(locale, fd);
              if (!res.ok) {
                const base = t(`uploadError_${res.error}`);
                setError(
                  res.error === "UPLOAD_FAILED" && res.detail
                    ? `${base} ${res.detail}`
                    : base,
                );
                return;
              }
              toast.success(t("uploadSuccess"));
              setOpen(false);
              form.reset();
            });
          }}
        >
          {folderSlug ? (
            <input type="hidden" name="folderSlug" value={folderSlug} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="cloud-up-file">{t("uploadFieldFile")}</Label>
            <Input
              id="cloud-up-file"
              name="file"
              type="file"
              required
              disabled={pending}
              className="cursor-pointer"
            />
            <p className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
              <FileUp className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {t("uploadFieldFileHint")}
            </p>
          </div>

          {!studentDeposit ? (
            <div className="space-y-2">
              <Label htmlFor="cloud-up-class">{t("uploadFieldClass")}</Label>
              {classOptions.length === 0 ? (
                <p className="text-sm text-destructive">{t("uploadNoClassAvailable")}</p>
              ) : (
                <>
                  <select
                    id="cloud-up-class"
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
          ) : (
            <input type="hidden" name="classId" value={forcedClassId ?? ""} />
          )}

          <CloudClassFolderPlacementPicker
            locale={locale}
            dialogOpen={open}
            selectedClassId={
              studentDeposit ? forcedClassId : selectedClassId
            }
            seededFolderOptions={seededForPicker}
            preferredFolderId={
              seededForPicker?.classId === pickerClassGate &&
              defaultClassFolderId &&
              defaultClassFolderId !== "__root__"
                ? defaultClassFolderId
                : undefined
            }
            selectId="cloud-up-class-folder"
            disabled={pending}
            studentDeposit={studentDeposit}
          />

          {!studentDeposit ? (
            <div className="space-y-2">
              <Label htmlFor="cloud-up-student">{t("uploadFieldStudent")}</Label>
              <select
                id="cloud-up-student"
                name="studentId"
                disabled={pending}
                defaultValue={defaultStudentId ?? "__none__"}
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
                <p className="text-xs text-muted-foreground">
                  {t("uploadFieldStudentHint")}
                </p>
              ) : null}
            </div>
          ) : null}

          {studentDeposit ? (
            <input type="hidden" name="cloudAudience" value="STUDENTS" />
          ) : (
            <CloudDocumentAudienceRadios
              disabled={pending}
              fieldIdPrefix="cloud-up-audience"
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="cloud-up-name">{t("uploadFieldDocumentName")}</Label>
            <Input
              id="cloud-up-name"
              name="documentName"
              required
              disabled={pending}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloud-up-version">{t("uploadFieldVersion")}</Label>
            <Input
              id="cloud-up-version"
              name="version"
              type="number"
              min={1}
              step={1}
              defaultValue={1}
              required
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloud-up-depositor">
              {studentDeposit
                ? t("uploadFieldDepositorStudent")
                : t("uploadFieldDepositor")}
            </Label>
            <Input
              id="cloud-up-depositor"
              value={depositorLabel}
              readOnly
              disabled
              className="bg-muted/50"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("uploadCancel")}
            </Button>
            <Button type="submit" disabled={pending || (!studentDeposit && classOptions.length === 0)} variant="accent">
              {pending
                ? t("uploadSubmitting")
                : studentDeposit
                  ? t("uploadSubmitStudent")
                  : t("uploadSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
