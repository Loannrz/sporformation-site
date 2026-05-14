"use client";

import { ArrowLeft, Folder } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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
  ClassCloudAudienceIndexRow,
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
  audienceIndexRows,
  subfolders,
  files,
  viewerId,
  viewerIsDirector,
  classOptions,
  studentOptions,
  folderSlug,
  folderOptionsForClass,
  initialAudienceTab,
  studentSubfolderCreate,
}: {
  locale: AppLocale;
  viewerRole: UserRole;
  displayTitle: string;
  subtitle: string;
  folderLinkBase: string;
  currentFolderId: string | null;
  classFolderRows: ClassCloudFolderRow[];
  audienceIndexRows: ClassCloudAudienceIndexRow[];
  subfolders: ClassCloudFolderRow[];
  files: CloudFolderFileWithUrl[];
  viewerId: string;
  viewerIsDirector: boolean;
  classOptions: CloudClassSelectOption[];
  studentOptions: CloudStudentUploadOption[];
  folderSlug?: string | null;
  folderOptionsForClass?: FolderOptionsForClass;
  initialAudienceTab: CloudClassFolderAudienceTab;
  studentSubfolderCreate?: {
    classId: string;
    parentFolderId: string;
  };
}) {
  const t = useTranslations("cloud");
  const [audienceTab, setAudienceTab] =
    useState<CloudClassFolderAudienceTab>(initialAudienceTab);

  const filteredFiles = useMemo(() => {
    if (viewerRole === "ELEVE") {
      return filterFilesForTab(files, "students");
    }
    return filterFilesForTab(files, audienceTab);
  }, [files, audienceTab, viewerRole]);

  const filteredSubfolders = useMemo(() => {
    if (viewerRole === "ELEVE") {
      return subfolders.filter((sf) => {
        if (currentFolderId === null) {
          return (
            sf.systemKind === STUDENT_INBOX_FOLDER_KIND ||
            sf.name.trim() === "Documents des élèves"
          );
        }
        return true;
      });
    }
    /* Le personnel doit voir toute l’arborescence (dont les dossiers vides et le dossier système élèves) ; les onglets ci-dessus filtrent uniquement la liste des fichiers. */
    return subfolders;
  }, [viewerRole, subfolders, currentFolderId]);

  const hasAdminInIndex = useMemo(
    () =>
      audienceIndexRows.some((r) =>
        fileMatchesCloudClassFolderAudienceTab(r.cloudAudience, "administration"),
      ),
    [audienceIndexRows],
  );
  const hasStudentsInIndex = useMemo(
    () =>
      audienceIndexRows.some((r) =>
        fileMatchesCloudClassFolderAudienceTab(r.cloudAudience, "students"),
      ),
    [audienceIndexRows],
  );

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="flex flex-col gap-4 border-b border-border/60 bg-muted/15 p-6 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 flex-col space-y-1.5">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            {displayTitle}
          </CardTitle>
          <CardDescription className="text-base">{subtitle}</CardDescription>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-[min(100%,20rem)] sm:items-end">
          <div
            className="flex w-full flex-wrap gap-2 sm:justify-end"
            role={viewerRole !== "ELEVE" ? "group" : undefined}
            aria-label={
              viewerRole !== "ELEVE"
                ? t("classFolderAudienceGroupLabel")
                : undefined
            }
          >
            {studentSubfolderCreate ? (
              <CloudStudentInboxSubfolderButton
                locale={locale}
                classId={studentSubfolderCreate.classId}
                parentFolderId={studentSubfolderCreate.parentFolderId}
              />
            ) : null}
            {viewerRole !== "ELEVE" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    audienceTab === "students" ? "secondary" : "outline"
                  }
                  disabled={!hasStudentsInIndex}
                  className={cn(
                    "text-xs sm:text-sm",
                    audienceTab === "students" &&
                      "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
                  )}
                  onClick={() => setAudienceTab("students")}
                >
                  {t("classFolderAudienceFilterStudents")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    audienceTab === "administration" ? "secondary" : "outline"
                  }
                  disabled={!hasAdminInIndex}
                  className={cn(
                    "text-xs sm:text-sm",
                    audienceTab === "administration" &&
                      "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
                  )}
                  onClick={() => setAudienceTab("administration")}
                >
                  {t("classFolderAudienceFilterAdmin")}
                </Button>
              </>
            ) : null}
          </div>
          {viewerRole !== "ELEVE" ? (
            <p className="text-[11px] leading-snug text-muted-foreground sm:text-right sm:text-xs">
              {audienceTab === "administration"
                ? t("classFolderAudienceFilterHintAdmin")
                : t("classFolderAudienceFilterHintStudents")}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-8 p-6 sm:p-8">
        {subfolders.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("classSubfoldersHeading")}
            </h2>
            {filteredSubfolders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("classFolderAudienceNoMatchingSubfolders")}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {currentFolderId !== null ? (
                  <Link
                    href={folderLinkBase}
                    className="flex items-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm transition hover:border-primary/40 hover:bg-muted/40"
                  >
                    <Folder className="h-9 w-9 shrink-0 text-muted-foreground" />
                    <span className="font-medium">
                      {t("classFolderBreadcrumbRoot")}
                    </span>
                  </Link>
                ) : null}
                {filteredSubfolders.map((sf) => (
                  <Link
                    key={sf.id}
                    href={`${folderLinkBase}?folder=${sf.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm transition hover:border-primary/35 hover:shadow-md"
                  >
                    <Folder className="h-9 w-9 shrink-0 text-amber-700/90 dark:text-amber-400/90" />
                    <span className="line-clamp-2 font-medium leading-snug">
                      {sf.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {subfolders.length === 0 && currentFolderId !== null ? (
          <Link
            href={folderLinkBase}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("classFolderBackRoot")}
          </Link>
        ) : null}

        {filteredFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {files.length > 0
              ? t("classFolderAudienceNoMatchingFiles")
              : t("folderNoDocuments")}
          </p>
        ) : (
          <CloudFolderFileBrowser
            files={filteredFiles}
            locale={locale}
            viewerId={viewerId}
            viewerIsDirector={viewerIsDirector}
            classOptions={classOptions}
            studentOptions={studentOptions}
            folderSlug={folderSlug}
            folderOptionsForClass={folderOptionsForClass}
            hideSearch={viewerRole === "ELEVE"}
          />
        )}
      </CardContent>
    </Card>
  );
}
