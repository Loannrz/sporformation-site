"use client";

import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadCloudDocumentAction } from "@/app/actions/cloud-files";
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

export type CloudClassSelectOption = { id: string; label: string };

type Props = {
  locale: AppLocale;
  viewer: { firstName: string; lastName: string };
  classOptions: CloudClassSelectOption[];
  defaultClassId: string | null;
  /** Segments bruts de l’URL dossier pour revalidation (ex. `classe-<uuid>`). */
  folderSlug?: string | null;
};

export function CloudUploadDocumentButton({
  locale,
  viewer,
  classOptions,
  defaultClassId,
  folderSlug = null,
}: Props) {
  const t = useTranslations("cloud");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const depositorLabel = `${viewer.firstName} ${viewer.lastName}`.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-2">
          <Upload className="h-4 w-4" />
          {t("uploadDocumentButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("uploadDialogTitle")}</DialogTitle>
          <DialogDescription>{t("uploadDialogDescription")}</DialogDescription>
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
            <p className="text-xs text-muted-foreground">{t("uploadFieldFileHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloud-up-class">{t("uploadFieldClass")}</Label>
            <select
              id="cloud-up-class"
              name="classId"
              required
              disabled={pending}
              defaultValue={defaultClassId ?? "__none__"}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="__none__">{t("uploadNoClass")}</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloud-up-depositor">{t("uploadFieldDepositor")}</Label>
            <Input
              id="cloud-up-depositor"
              value={depositorLabel}
              readOnly
              disabled
              className="bg-muted/50"
            />
          </div>

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
            <Label htmlFor="cloud-up-desc">{t("uploadFieldDescription")}</Label>
            <Textarea
              id="cloud-up-desc"
              name="description"
              required
              disabled={pending}
              rows={4}
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
            <Button type="submit" disabled={pending} variant="accent">
              {pending ? t("uploadSubmitting") : t("uploadSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
