"use client";

import { ArrowLeft, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fileMatchesCloudClassFolderAudienceTab } from "@/lib/cloud-document-audience";
import type { CloudClassFolderAudienceTab } from "@/lib/cloud-document-audience";
import { cn } from "@/lib/utils";
import type {
  ClassCloudFolderRow,
  CloudFolderFileWithUrl,
  CloudStudentUploadOption,
} from "@/lib/data/school";
import {
  STUDENT_INBOX_FOLDER_KIND,
} from "@/lib/cloud/class-cloud-folder-helpers";
import type { UserRole } from "@/types";

import type { AppLocale } from "@/i18n/routing";
import type { CloudClassSelectOption } from "./cloud-upload-document-button";
import { CloudFolderFileBrowser } from "./cloud-folder-file-browser";
import { CloudStudentInboxSubfolderButton } from "@/components/cloud/cloud-student-inbox-subfolder-button";

type FolderOptionsForClass = {
  classId: string;
  options: { id: string; label: string }[];
};

function filterFilesForTab(
  files: CloudFolderFileWithUrl[],
  tab: CloudClassFolderAudienceTab,
): CloudFolderFileWithUrl[] {
  return files.filter((f) =>
    fileMatchesCloudClassFolderAudienceTab(f.cloudAudience, tab),
  );
}


export function CloudClassFolderPageBody({
  locale,
  viewerRole,
  displayTitle,
  subtitle,
  folderLinkBase,
  currentFolderId,
  classFolderRows,
  subfolders,
  files,
  viewerId,
  viewerIsDirector,
  viewerStudentId = null,
  classOptions,
  studentOptions,
  folderSlug,
  folderOptionsForClass,
  studentSubfolderCreate,
  studentDepositNav,
}: {
  locale: AppLocale;
  viewerRole: UserRole;
  displayTitle: string;
  subtitle?: string | null;
  folderLinkBase: string;
  currentFolderId: string | null;
  classFolderRows: ClassCloudFolderRow[];
  subfolders: ClassCloudFolderRow[];
  files: CloudFolderFileWithUrl[];
  viewerId: string;
  viewerIsDirector: boolean;
  /** Si rôle élève, identifiant `students.id` permettant d'éditer ses dépôts. */
  viewerStudentId?: string | null;
  classOptions: CloudClassSelectOption[];
  studentOptions: CloudStudentUploadOption[];
  folderSlug?: string | null;
  folderOptionsForClass?: FolderOptionsForClass;
  studentSubfolderCreate?: {
    classId: string;
    parentFolderId: string;
  };
  /** Navigation restreinte élève : racine dépôt + sous-arbre accessible. */
  studentDepositNav?: {
    landingFolderId: string;
    accessibleFolderIds: string[];
  };
}) {
  const t = useTranslations("cloud");

  const filteredFiles = useMemo(() => {
    if (viewerRole === "ELEVE") {
      return filterFilesForTab(files, "students");
    }
    return files;
  }, [files, viewerRole]);

  const accessibleFolderSet = useMemo(
    () =>
      studentDepositNav
        ? new Set(studentDepositNav.accessibleFolderIds)
        : null,
    [studentDepositNav],
  );

  const filteredSubfolders = useMemo(() => {
    if (viewerRole === "ELEVE") {
      if (!accessibleFolderSet) return [];
      return subfolders.filter((sf) => accessibleFolderSet.has(sf.id));
    }
    /* Le personnel voit toute l’arborescence (dont les dossiers vides et le dossier système élèves). La liste fichiers élève est limitée aux documents « cours ». */
    return subfolders;
  }, [viewerRole, subfolders, accessibleFolderSet]);

  const studentDepositRootHref = studentDepositNav
    ? `${folderLinkBase}?folder=${studentDepositNav.landingFolderId}`
    : null;

  const showStudentDepositNavUp =
    studentDepositNav != null &&
    studentDepositRootHref != null &&
    currentFolderId !== null &&
    currentFolderId !== studentDepositNav.landingFolderId;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-lg shadow-black/[0.03] ring-1 ring-black/[0.03] dark:shadow-black/25 dark:ring-white/[0.06]">
      <CardHeader className="flex flex-col gap-4 border-b border-border/50 bg-gradient-to-br from-sky-500/[0.06] via-muted/30 to-muted/10 p-6 pb-6 dark:from-sky-500/10 dark:via-muted/20 dark:to-muted/5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col space-y-1.5">
          <CardTitle className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
            {displayTitle}
          </CardTitle>
          {subtitle?.trim() ? (
            <CardDescription className="text-base">{subtitle}</CardDescription>
          ) : null}
        </div>
        {studentSubfolderCreate ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-[min(100%,22rem)] sm:items-end">
            <div
              className={cn(
                "flex w-full flex-wrap gap-1.5 sm:justify-end rounded-xl border border-border/50 bg-background/60 p-1 shadow-inner dark:bg-background/40",
              )}
              role="group"
            >
              <CloudStudentInboxSubfolderButton
                locale={locale}
                classId={studentSubfolderCreate.classId}
                parentFolderId={studentSubfolderCreate.parentFolderId}
              />
            </div>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-10 p-6 sm:p-8">
        {subfolders.length > 0 ? (
          <section
            className={cn(
              "rounded-2xl border border-border/50 bg-gradient-to-b from-muted/50 to-muted/15 p-5 shadow-inner sm:p-6",
              "dark:from-muted/30 dark:to-muted/5",
            )}
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 shadow-sm ring-1 ring-amber-500/20 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/25">
                  <FolderOpen className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {t("classSubfoldersHeading")}
                  </h2>
                  {viewerRole !== "ELEVE" && currentFolderId === null ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t("classFolderStudentVisibilityStaffHint")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {filteredSubfolders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("classFolderAudienceNoMatchingSubfolders")}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {showStudentDepositNavUp && studentDepositRootHref ? (
                  <Link
                    href={studentDepositRootHref}
                    className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/25 bg-background/70 p-4 text-sm shadow-sm backdrop-blur-sm transition hover:border-primary/45 hover:bg-primary/[0.04] dark:bg-background/40"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
                      <ArrowLeft className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 font-semibold leading-snug">
                      {t("studentFolderNavDepositRoot")}
                    </span>
                  </Link>
                ) : null}
                {!studentDepositNav && currentFolderId !== null ? (
                  <Link
                    href={folderLinkBase}
                    className="group flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/25 bg-background/70 p-4 text-sm shadow-sm backdrop-blur-sm transition hover:border-primary/45 hover:bg-primary/[0.04] dark:bg-background/40"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
                      <ArrowLeft className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 font-semibold leading-snug">
                      {t("classFolderBreadcrumbRoot")}
                    </span>
                  </Link>
                ) : null}
                {filteredSubfolders.map((sf) => {
                  const isStudentInbox =
                    sf.systemKind === STUDENT_INBOX_FOLDER_KIND ||
                    sf.name.trim() === "Documents des élèves";
                  return (
                    <Link
                      key={sf.id}
                      href={`${folderLinkBase}?folder=${sf.id}`}
                      className={cn(
                        "group relative flex min-h-[4.25rem] items-center gap-3 overflow-hidden rounded-2xl border p-4 text-sm shadow-sm transition",
                        "hover:-translate-y-0.5 hover:shadow-md",
                        isStudentInbox
                          ? "border-sky-400/35 bg-gradient-to-br from-sky-500/[0.12] via-card to-card dark:border-sky-500/30 dark:from-sky-500/15"
                          : "border-border/70 bg-card/90 hover:border-primary/30 dark:bg-card/80",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition",
                          isStudentInbox
                            ? "bg-sky-500/20 text-sky-800 ring-sky-500/25 dark:bg-sky-500/25 dark:text-sky-100 dark:ring-sky-400/30"
                            : "bg-amber-500/12 text-amber-800 ring-amber-500/15 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25",
                        )}
                      >
                        <Folder className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug tracking-tight">
                        {sf.name}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {subfolders.length === 0 && currentFolderId !== null ? (
          showStudentDepositNavUp && studentDepositRootHref ? (
            <Link
              href={studentDepositRootHref}
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/35 hover:bg-muted/50"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              {t("studentFolderBackDepositRoot")}
            </Link>
          ) : (
            <Link
              href={folderLinkBase}
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/35 hover:bg-muted/50"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              {t("classFolderBackRoot")}
            </Link>
          )
        ) : null}

        <div className="space-y-4 border-t border-border/40 pt-8">
          {filteredFiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center">
              <p className="text-sm text-muted-foreground">
                {viewerRole === "ELEVE" && files.length > 0
                  ? t("classFolderAudienceNoMatchingFiles")
                  : t("folderNoDocuments")}
              </p>
            </div>
          ) : (
            <CloudFolderFileBrowser
              files={filteredFiles}
              locale={locale}
              viewerId={viewerId}
              viewerIsDirector={viewerIsDirector}
              viewerStudentId={viewerStudentId}
              classOptions={classOptions}
              studentOptions={studentOptions}
              folderSlug={folderSlug}
              folderOptionsForClass={folderOptionsForClass}
              hideSearch={viewerRole === "ELEVE"}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
