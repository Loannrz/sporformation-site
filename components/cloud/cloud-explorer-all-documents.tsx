"use client";

import { FileText, LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CloudExplorerFileWithUrl, CloudStudentUploadOption } from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import { CloudEditDocumentButton } from "./cloud-edit-document-button";
import type { CloudClassSelectOption } from "./cloud-upload-document-button";

function isImageMime(mime: string | null): boolean {
  return Boolean(mime?.toLowerCase().startsWith("image/"));
}

export type CloudAllDocumentsSort =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "class-asc"
  | "class-desc"
  | "teacher-asc"
  | "teacher-desc"
  | "student-asc"
  | "student-desc";

type ViewMode = "grid" | "list";

type Props = {
  files: CloudExplorerFileWithUrl[];
  searchQuery: string;
  locale: AppLocale;
  viewerId: string;
  viewerIsDirector: boolean;
  classOptions: CloudClassSelectOption[];
  studentOptions: CloudStudentUploadOption[];
};

function matchesDocSearch(f: CloudExplorerFileWithUrl, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const blob = [
    f.title,
    f.description,
    f.classLabel ?? "",
    f.teacherName ?? "",
    f.studentName ?? "",
  ]
    .join("\n")
    .toLowerCase();
  return blob.includes(q);
}

/** Liste / grille carrée de tous les documents Cloud avec tri et recherche. */
export function CloudExplorerAllDocuments({
  files,
  searchQuery,
  locale,
  viewerId,
  viewerIsDirector,
  classOptions,
  studentOptions,
}: Props) {
  const t = useTranslations("cloud");
  const mayEditRow = (ownerId: string | null) =>
    viewerIsDirector || Boolean(ownerId && ownerId === viewerId);
  const [sort, setSort] = useState<CloudAllDocumentsSort>("date-desc");
  const [view, setView] = useState<ViewMode>("grid");

  const processed = useMemo(() => {
    const list = files.filter((f) => matchesDocSearch(f, searchQuery));
    const time = (s: string) => {
      const n = new Date(s).getTime();
      return Number.isFinite(n) ? n : 0;
    };
    const classKey = (f: CloudExplorerFileWithUrl) =>
      (f.classLabel ?? "\uffff").toLowerCase();
    const teacherKey = (f: CloudExplorerFileWithUrl) =>
      (f.teacherName ?? "\uffff").toLowerCase();
    const studentKey = (f: CloudExplorerFileWithUrl) =>
      (f.studentName ?? "\uffff").toLowerCase();

    const cmp: Record<CloudAllDocumentsSort, (a: CloudExplorerFileWithUrl, b: CloudExplorerFileWithUrl) => number> = {
      "date-desc": (a, b) => time(b.createdAt) - time(a.createdAt),
      "date-asc": (a, b) => time(a.createdAt) - time(b.createdAt),
      "name-asc": (a, b) =>
        a.title.localeCompare(b.title, locale, { sensitivity: "base" }),
      "name-desc": (a, b) =>
        b.title.localeCompare(a.title, locale, { sensitivity: "base" }),
      "class-asc": (a, b) => classKey(a).localeCompare(classKey(b), locale),
      "class-desc": (a, b) => classKey(b).localeCompare(classKey(a), locale),
      "teacher-asc": (a, b) =>
        teacherKey(a).localeCompare(teacherKey(b), locale),
      "teacher-desc": (a, b) =>
        teacherKey(b).localeCompare(teacherKey(a), locale),
      "student-asc": (a, b) =>
        studentKey(a).localeCompare(studentKey(b), locale),
      "student-desc": (a, b) =>
        studentKey(b).localeCompare(studentKey(a), locale),
    };
    list.sort(cmp[sort]);
    return list;
  }, [files, searchQuery, sort, locale]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const labelClass = (f: CloudExplorerFileWithUrl) =>
    f.classLabel ?? t("explorerNoClass");
  const labelTeacher = (f: CloudExplorerFileWithUrl) =>
    f.teacherName ?? t("explorerNoTeacher");

  const docMetaLine = (f: CloudExplorerFileWithUrl) => {
    const parts: string[] = [labelClass(f), labelTeacher(f)];
    if (f.studentName) {
      parts.push(`${t("explorerStudentLabel")}: ${f.studentName}`);
    }
    return parts.join(" · ");
  };

  const sortBtn = (mode: CloudAllDocumentsSort, label: string) => (
    <Button
      key={mode}
      type="button"
      size="sm"
      variant={sort === mode ? "secondary" : "outline"}
      onClick={() => setSort(mode)}
      className={cn(
        "text-xs sm:text-sm",
        sort === mode &&
          "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
      )}
    >
      {label}
    </Button>
  );

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
        {t("explorerAllDocsEmpty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div
          className="flex flex-wrap gap-2"
          role="toolbar"
          aria-label={t("explorerAllDocsSortToolbar")}
        >
          {sortBtn("date-desc", t("folderSortDateNew"))}
          {sortBtn("date-asc", t("folderSortDateOld"))}
          {sortBtn("name-asc", t("folderSortNameAZ"))}
          {sortBtn("name-desc", t("folderSortNameZA"))}
          {sortBtn("class-asc", t("explorerSortClassAZ"))}
          {sortBtn("class-desc", t("explorerSortClassZA"))}
          {sortBtn("teacher-asc", t("explorerSortTeacherAZ"))}
          {sortBtn("teacher-desc", t("explorerSortTeacherZA"))}
          {sortBtn("student-asc", t("explorerSortStudentAZ"))}
          {sortBtn("student-desc", t("explorerSortStudentZA"))}
        </div>
        <div
          className="flex shrink-0 gap-1 rounded-xl border border-border bg-muted/40 p-1 dark:bg-muted/30"
          role="group"
          aria-label={t("explorerViewModeLabel")}
        >
          <Button
            type="button"
            size="sm"
            variant={view === "grid" ? "secondary" : "ghost"}
            className={cn(
              "h-9 w-9 p-0",
              view === "grid" && "bg-card shadow-sm",
            )}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label={t("explorerViewGrid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className={cn(
              "h-9 w-9 p-0",
              view === "list" && "bg-card shadow-sm",
            )}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label={t("explorerViewList")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {processed.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("explorerNoSearchResults")}</p>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {processed.map((f) => {
            const preview = f.signedUrl && isImageMime(f.mime);
            const showEdit = mayEditRow(f.ownerId);
            return (
              <div
                key={f.id}
                className="grid aspect-square min-h-0 grid-rows-[1fr_auto] overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-foreground/20 hover:shadow-md"
              >
                <div className="relative min-h-0 overflow-hidden bg-muted/45">
                  {preview ? (
                    <img
                      src={f.signedUrl!}
                      alt={t("folderPreviewAlt", { title: f.title })}
                      className="absolute inset-0 h-full w-full object-cover object-top"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full min-h-[4.5rem] items-center justify-center p-4">
                      <FileText
                        className="h-10 w-10 shrink-0 text-muted-foreground sm:h-12 sm:w-12"
                        aria-hidden
                      />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1 border-t border-border/60 bg-card p-2">
                  <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground sm:text-xs">
                    {f.title}
                  </p>
                  <p className="line-clamp-2 text-[10px] text-muted-foreground sm:line-clamp-3">
                    {docMetaLine(f)}
                  </p>
                  {f.signedUrl ? (
                    <div className="mt-1 flex w-full gap-1.5">
                      <Button
                        asChild
                        size="sm"
                        variant="secondary"
                        className="h-8 min-w-0 flex-1 text-[11px]"
                      >
                        <a
                          href={f.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          {t("folderDownload")}
                        </a>
                      </Button>
                      {showEdit ? (
                        <CloudEditDocumentButton
                          locale={locale}
                          file={{
                            id: f.id,
                            title: f.title,
                            description: f.description,
                            classId: f.classId,
                            studentId: f.studentId,
                          }}
                          classOptions={classOptions}
                          studentOptions={studentOptions}
                          compact
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-1 flex w-full gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 min-w-0 flex-1 text-[11px]"
                        disabled
                      >
                        {t("folderDownloadUnavailable")}
                      </Button>
                      {showEdit ? (
                        <CloudEditDocumentButton
                          locale={locale}
                          file={{
                            id: f.id,
                            title: f.title,
                            description: f.description,
                            classId: f.classId,
                            studentId: f.studentId,
                          }}
                          classOptions={classOptions}
                          studentOptions={studentOptions}
                          compact
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <ul className="divide-y divide-border">
            {processed.map((f) => {
              const preview = f.signedUrl && isImageMime(f.mime);
              const showEdit = mayEditRow(f.ownerId);
              return (
                <li key={f.id}>
                  <div className="flex flex-wrap items-center gap-3 p-3 sm:gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/50 sm:h-16 sm:w-16">
                      {preview ? (
                        <img
                          src={f.signedUrl!}
                          alt=""
                          className="h-full w-full object-cover object-top"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-[140px] flex-1">
                      <p className="font-medium leading-snug text-foreground">
                        {f.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {docMetaLine(f)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3">
                      <span className="tabular-nums">{formatDate(f.createdAt)}</span>
                      <span className="tabular-nums">
                        {t("folderFileVersion", { version: f.version })}
                      </span>
                      {f.signedUrl ? (
                        <Button asChild size="sm" variant="secondary" className="shrink-0">
                          <a
                            href={f.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            {t("folderDownload")}
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" disabled className="shrink-0">
                          {t("folderDownloadUnavailable")}
                        </Button>
                      )}
                      {showEdit ? (
                        <CloudEditDocumentButton
                          locale={locale}
                          file={{
                            id: f.id,
                            title: f.title,
                            description: f.description,
                            classId: f.classId,
                            studentId: f.studentId,
                          }}
                          classOptions={classOptions}
                          studentOptions={studentOptions}
                          compact
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
