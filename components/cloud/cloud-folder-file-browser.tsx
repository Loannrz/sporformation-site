"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CloudFolderFileWithUrl } from "@/lib/data/school";
import { CloudFolderFileGrid } from "./cloud-folder-file-grid";

export type CloudFolderSortMode =
  | "date-desc"
  | "date-asc"
  | "version-desc"
  | "version-asc"
  | "name-asc"
  | "name-desc";

type Props = {
  files: CloudFolderFileWithUrl[];
};

export function CloudFolderFileBrowser({ files }: Props) {
  const t = useTranslations("cloud");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CloudFolderSortMode>("date-desc");

  const processed = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? files.filter(
          (f) =>
            f.title.toLowerCase().includes(needle) ||
            f.description.toLowerCase().includes(needle),
        )
      : [...files];

    const time = (s: string) => {
      const n = new Date(s).getTime();
      return Number.isFinite(n) ? n : 0;
    };

    const comparators: Record<CloudFolderSortMode, (a: CloudFolderFileWithUrl, b: CloudFolderFileWithUrl) => number> = {
      "date-desc": (a, b) => time(b.createdAt) - time(a.createdAt),
      "date-asc": (a, b) => time(a.createdAt) - time(b.createdAt),
      "version-desc": (a, b) => b.version - a.version,
      "version-asc": (a, b) => a.version - b.version,
      "name-asc": (a, b) =>
        a.title.localeCompare(b.title, locale, { sensitivity: "base" }),
      "name-desc": (a, b) =>
        b.title.localeCompare(a.title, locale, { sensitivity: "base" }),
    };

    list.sort(comparators[sort]);
    return list;
  }, [files, query, sort, locale]);

  const needle = query.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="relative w-full lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            className="pl-9"
            placeholder={t("folderSearchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="toolbar"
          aria-label={t("folderSortToolbarLabel")}
        >
          <Button
            type="button"
            size="sm"
            variant={sort === "date-desc" ? "secondary" : "outline"}
            onClick={() => setSort("date-desc")}
            className={cn(
              "text-xs sm:text-sm",
              sort === "date-desc" && "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
            )}
          >
            {t("folderSortDateNew")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sort === "date-asc" ? "secondary" : "outline"}
            onClick={() => setSort("date-asc")}
            className={cn(
              "text-xs sm:text-sm",
              sort === "date-asc" && "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
            )}
          >
            {t("folderSortDateOld")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sort === "version-desc" ? "secondary" : "outline"}
            onClick={() => setSort("version-desc")}
            className={cn(
              "text-xs sm:text-sm",
              sort === "version-desc" && "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
            )}
          >
            {t("folderSortVersionHigh")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sort === "version-asc" ? "secondary" : "outline"}
            onClick={() => setSort("version-asc")}
            className={cn(
              "text-xs sm:text-sm",
              sort === "version-asc" && "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
            )}
          >
            {t("folderSortVersionLow")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sort === "name-asc" ? "secondary" : "outline"}
            onClick={() => setSort("name-asc")}
            className={cn(
              "text-xs sm:text-sm",
              sort === "name-asc" && "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
            )}
          >
            {t("folderSortNameAZ")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sort === "name-desc" ? "secondary" : "outline"}
            onClick={() => setSort("name-desc")}
            className={cn(
              "text-xs sm:text-sm",
              sort === "name-desc" && "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
            )}
          >
            {t("folderSortNameZA")}
          </Button>
        </div>
      </div>

      {processed.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {needle ? t("folderSearchNoResults") : t("folderNoDocuments")}
        </p>
      ) : (
        <CloudFolderFileGrid files={processed} />
      )}
    </div>
  );
}
