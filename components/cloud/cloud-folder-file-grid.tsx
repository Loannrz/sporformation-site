"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CloudFolderFileWithUrl, CloudStudentUploadOption } from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import type { CloudClassSelectOption } from "./cloud-upload-document-button";
import { CloudDocumentAudienceBadge } from "@/components/cloud/cloud-audience-ui";
import { CloudEditDocumentButton } from "./cloud-edit-document-button";

function isImageMime(mime: string | null): boolean {
  return Boolean(mime?.toLowerCase().startsWith("image/"));
}

type FolderOptionsForClass = {
  classId: string;
  options: { id: string; label: string }[];
};

type Props = {
  files: CloudFolderFileWithUrl[];
  locale: AppLocale;
  viewerId: string;
  viewerIsDirector: boolean;
  classOptions: CloudClassSelectOption[];
  studentOptions: CloudStudentUploadOption[];
  folderSlug?: string | null;
  folderOptionsForClass?: FolderOptionsForClass;
};

export function CloudFolderFileGrid({
  files,
  locale,
  viewerId,
  viewerIsDirector,
  classOptions,
  studentOptions,
  folderSlug = null,
  folderOptionsForClass,
}: Props) {
  const t = useTranslations("cloud");

  const mayEditRow = (ownerId: string | null) =>
    viewerIsDirector || Boolean(ownerId && ownerId === viewerId);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {files.map((f) => {
        const preview = f.signedUrl && isImageMime(f.mime);
        const showEdit = mayEditRow(f.ownerId);
        return (
          <div
            key={f.id}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-foreground/20 hover:shadow-md"
          >
            <div className="relative aspect-square w-full bg-muted/50">
              {preview ? (
                <img
                  src={f.signedUrl!}
                  alt={t("folderPreviewAlt", { title: f.title })}
                  className="h-full w-full object-contain object-center"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6">
                  <FileText
                    className="h-14 w-14 shrink-0 text-muted-foreground md:h-16 md:w-16"
                    aria-hidden
                  />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="flex flex-wrap items-start gap-1.5 gap-y-1">
                <CloudDocumentAudienceBadge audience={f.cloudAudience} />
                <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                  {f.title}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("folderFileVersion", { version: f.version })}
              </p>
              {f.signedUrl ? (
                <div className="mt-auto flex flex-col gap-2">
                  <div
                    className={
                      showEdit
                        ? "flex w-full gap-2"
                        : "flex w-full flex-col gap-2"
                    }
                  >
                    <Button
                      asChild
                      size="sm"
                      variant="secondary"
                      className={
                        showEdit ? "min-w-0 flex-1" : "w-full"
                      }
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
                          classFolderId: f.classFolderId,
                          cloudAudience: f.cloudAudience,
                        }}
                        classOptions={classOptions}
                        studentOptions={studentOptions}
                        folderSlug={folderSlug}
                        folderOptionsForClass={folderOptionsForClass}
                        compact
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-auto flex flex-col gap-2">
                  <div
                    className={
                      showEdit
                        ? "flex w-full gap-2"
                        : "flex w-full flex-col gap-2"
                    }
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      className={
                        showEdit ? "min-w-0 flex-1" : "w-full"
                      }
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
                          classFolderId: f.classFolderId,
                          cloudAudience: f.cloudAudience,
                        }}
                        classOptions={classOptions}
                        studentOptions={studentOptions}
                        folderSlug={folderSlug}
                        folderOptionsForClass={folderOptionsForClass}
                        compact
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
