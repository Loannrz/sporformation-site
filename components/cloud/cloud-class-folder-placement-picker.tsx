"use client";

import { FolderOpen, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchClassCloudFolderPickOptionsAction } from "@/app/actions/cloud-files";
import type { AppLocale } from "@/i18n/routing";
import { Label } from "@/components/ui/label";

export type SeededFolderOptions = {
  classId: string;
  options: { id: string; label: string }[];
};

export function CloudClassFolderPlacementPicker({
  locale,
  dialogOpen,
  selectedClassId,
  seededFolderOptions,
  preferredFolderId,
  selectId,
  disabled,
  name = "classFolderId",
}: {
  locale: AppLocale;
  dialogOpen: boolean;
  selectedClassId: string | null;
  seededFolderOptions?: SeededFolderOptions;
  /** Sous-dossier initial (uuid) ; préfére la racine si absent ou invalide */
  preferredFolderId?: string | null;
  selectId: string;
  disabled?: boolean;
  name?: string;
}) {
  const t = useTranslations("cloud");
  const manualPickRef = useRef(false);
  const prefHydratedRef = useRef(false);

  const [picked, setPicked] = useState("__root__");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState<SeededFolderOptions | null>(null);
  const fetchGenRef = useRef(0);

  const prevClassRef = useRef(selectedClassId);
  useEffect(() => {
    if (prevClassRef.current !== selectedClassId) {
      prevClassRef.current = selectedClassId;
      manualPickRef.current = false;
      prefHydratedRef.current = false;
      setPicked("__root__");
      setFetched(null);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (!dialogOpen) {
      manualPickRef.current = false;
      prefHydratedRef.current = false;
      setLoading(false);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (!dialogOpen || !selectedClassId) {
      return;
    }

    if (seededFolderOptions?.classId === selectedClassId) {
      setLoading(false);
      return;
    }

    const requestId = ++fetchGenRef.current;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetchClassCloudFolderPickOptionsAction(
          locale,
          selectedClassId!,
        );
        if (cancelled || requestId !== fetchGenRef.current) {
          return;
        }
        if (!res.ok) {
          setFetched(null);
          return;
        }
        setFetched(
          res.options.length > 1
            ? { classId: selectedClassId!, options: res.options }
            : null,
        );
      } finally {
        if (requestId === fetchGenRef.current) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, locale, selectedClassId, seededFolderOptions?.classId]);

  const effectiveOptions = useMemo(() => {
    if (!selectedClassId) return null;

    const fromSeed =
      seededFolderOptions?.classId === selectedClassId &&
      seededFolderOptions.options.length > 1
        ? seededFolderOptions.options
        : null;
    if (fromSeed) return fromSeed;

    if (fetched?.classId === selectedClassId && fetched.options.length > 1) {
      return fetched.options;
    }

    return null;
  }, [selectedClassId, seededFolderOptions, fetched]);

  useEffect(() => {
    if (
      !dialogOpen ||
      !effectiveOptions?.length ||
      effectiveOptions.length <= 1 ||
      manualPickRef.current
    ) {
      return;
    }

    if (prefHydratedRef.current) return;

    const idSet = new Set(effectiveOptions.map((o) => o.id));

    let next = "__root__";
    const pref = preferredFolderId?.trim();
    if (pref && idSet.has(pref)) {
      next = pref;
    }

    setPicked(next);
    prefHydratedRef.current = true;
  }, [dialogOpen, effectiveOptions, preferredFolderId]);

  useEffect(() => {
    const idSet = new Set(effectiveOptions?.map((o) => o.id) ?? []);
    if (!idSet.has(picked)) {
      setPicked("__root__");
    }
  }, [effectiveOptions, picked]);

  if (!dialogOpen || !selectedClassId) {
    return null;
  }

  if (!effectiveOptions?.length || effectiveOptions.length <= 1) {
    const hasSeedForClass =
      seededFolderOptions?.classId === selectedClassId &&
      seededFolderOptions.options.length > 0;
    const showBusy = loading && !hasSeedForClass;

    if (showBusy) {
      return (
        <div
          className="flex items-center gap-3 rounded-xl border border-dashed border-primary/35 bg-muted/25 px-3 py-3 sm:py-4"
          aria-busy="true"
        >
          <Loader2
            className="h-5 w-5 shrink-0 animate-spin text-muted-foreground"
            aria-hidden
          />
          <p className="text-xs text-muted-foreground">{t("uploadClassFoldersLoading")}</p>
          <input type="hidden" name={name} value="__root__" />
        </div>
      );
    }

    return <input type="hidden" name={name} value="__root__" />;
  }

  return (
    <div className="flex gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05] sm:gap-4 sm:px-4 sm:py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-inner ring-1 ring-border/80 dark:bg-muted/40">
        <FolderOpen className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <Label htmlFor={selectId} className="text-sm font-semibold leading-tight">
            {t("uploadFieldClassFolder")}
          </Label>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {t("uploadPlacementSubtitle")}
          </p>
        </div>
        <select
          id={selectId}
          name={name}
          disabled={disabled}
          value={picked}
          onChange={(e) => {
            manualPickRef.current = true;
            setPicked(e.target.value);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {effectiveOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
