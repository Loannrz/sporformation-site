"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CloudFolderFileWithUrl } from "@/lib/data/school";

function isImageMime(mime: string | null): boolean {
  return Boolean(mime?.toLowerCase().startsWith("image/"));
}

type Props = {
  files: CloudFolderFileWithUrl[];
};

export function CloudFolderFileGrid({ files }: Props) {
  const t = useTranslations("cloud");

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {files.map((f) => {
        const preview = f.signedUrl && isImageMime(f.mime);
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
              <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                {f.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("folderFileVersion", { version: f.version })}
              </p>
              {f.signedUrl ? (
                <Button asChild size="sm" variant="secondary" className="mt-auto w-full">
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
                <Button size="sm" variant="secondary" className="mt-auto w-full" disabled>
                  {t("folderDownloadUnavailable")}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
