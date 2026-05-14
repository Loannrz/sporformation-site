"use client";

import { applyClassCloudFolderTemplateAction } from "@/app/actions/class-cloud-folders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cloudFolderTreeToTemplateRoots,
  type ClassCloudFolderTemplateNode,
} from "@/lib/class-cloud-folder-template";
import {
  addClassCloudFolderPreset,
  loadClassCloudFolderPresets,
  removeClassCloudFolderPreset,
  type StoredClassCloudFolderPreset,
} from "@/lib/class-cloud-folder-presets-storage";
import type { ClassCloudFolderNode } from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "next/navigation";
import { Bookmark, FolderInput, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  locale: AppLocale;
  classId: string;
  tree: ClassCloudFolderNode[];
};

export function ClassCloudFolderPresetButtons({ locale, classId, tree }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.classManage.cloudFolders.presets");
  const [saveOpen, setSaveOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => setSaveOpen(true)}
        >
          <Bookmark className="h-3.5 w-3.5" aria-hidden />
          {t("saveButton")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => setApplyOpen(true)}
        >
          <FolderInput className="h-3.5 w-3.5" aria-hidden />
          {t("applyButton")}
        </Button>
      </div>

      <SavePresetDialog open={saveOpen} onOpenChange={setSaveOpen} tree={tree} />

      <ApplyPresetDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        locale={locale}
        classId={classId}
        onApplied={() => router.refresh()}
      />
    </>
  );
}

function SavePresetDialog({
  open,
  onOpenChange,
  tree,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tree: ClassCloudFolderNode[];
}) {
  const t = useTranslations("admin.classManage.cloudFolders.presets");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) setLabel("");
  }, [open]);

  const roots = cloudFolderTreeToTemplateRoots(tree);
  const empty = roots.length === 0;

  const save = () => {
    const rootsToStore: ClassCloudFolderTemplateNode[] = JSON.parse(
      JSON.stringify(roots),
    );
    addClassCloudFolderPreset(label, rootsToStore);
    toast.success(t("saveSuccess"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("saveTitle")}</DialogTitle>
          <DialogDescription>{t("saveDescription")}</DialogDescription>
        </DialogHeader>
        {empty ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t("saveEmptyTree")}
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="preset-label">{t("saveNameLabel")}</Label>
            <Input
              id="preset-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("saveNamePlaceholder")}
            />
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={empty}>
            {t("saveConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyPresetDialog({
  open,
  onOpenChange,
  locale,
  classId,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locale: AppLocale;
  classId: string;
  onApplied: () => void;
}) {
  const t = useTranslations("admin.classManage.cloudFolders.presets");
  const [pending, startTransition] = useTransition();
  const [presets, setPresets] = useState<StoredClassCloudFolderPreset[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const list = loadClassCloudFolderPresets();
    setPresets(list);
    setSelectedId(list[0]?.id ?? "");
  }, [open]);

  const refreshList = () => {
    const list = loadClassCloudFolderPresets();
    setPresets(list);
    setSelectedId((prev) =>
      list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? ""),
    );
  };

  const apply = () => {
    const preset = presets.find((p) => p.id === selectedId);
    if (!preset) return;
    startTransition(async () => {
      const res = await applyClassCloudFolderTemplateAction(locale, {
        classId,
        roots: preset.roots,
      });
      if (!res.ok) {
        toast.error(
          res.error === "INVALID_TEMPLATE"
            ? t("errors.invalidTemplate")
            : res.error === "INVALID_CLASS"
              ? t("errors.invalidClass")
              : res.error === "NO_SERVICE_ROLE"
                ? t("errors.noServiceRole")
                : res.error === "FORBIDDEN"
                  ? t("errors.forbidden")
                  : res.error,
        );
        return;
      }
      toast.success(t("applySuccess", { count: res.createdCount }));
      onOpenChange(false);
      onApplied();
    });
  };

  const removePreset = (id: string) => {
    removeClassCloudFolderPreset(id);
    refreshList();
    toast.success(t("removedPreset"));
  };

  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("applyTitle")}</DialogTitle>
          <DialogDescription>{t("applyDescription")}</DialogDescription>
        </DialogHeader>
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("applyEmpty")}</p>
        ) : (
          <div className="space-y-3">
            <Label htmlFor="preset-pick">{t("applyPickLabel")}</Label>
            <select
              id="preset-pick"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} —{" "}
                  {new Date(p.savedAt).toLocaleDateString(localeTag, {
                    dateStyle: "short",
                  })}
                </option>
              ))}
            </select>
            <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2 text-sm">
              {presets.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1"
                >
                  <span className="min-w-0 truncate font-medium">{p.label}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t("removePresetAria")}
                    onClick={() => removePreset(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={apply}
            disabled={pending || presets.length === 0 || !selectedId}
          >
            {pending ? t("applyPending") : t("applyConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
