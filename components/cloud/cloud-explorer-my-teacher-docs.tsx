"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { TeacherOnboardingCloudFile } from "@/lib/data/teacher-documents";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import type { SessionUser } from "@/types";
import { FileText } from "lucide-react";

type Props = {
  user: SessionUser;
  files: TeacherOnboardingCloudFile[];
  searchQuery: string;
};

function matches(text: string, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return text.toLowerCase().includes(s);
}

export function CloudExplorerMyTeacherDocs({
  user,
  files,
  searchQuery,
}: Props) {
  const t = useTranslations("cloud");
  const showTeacherColumn = isDirector(user) || isStaffAdmin(user);

  const filtered = useMemo(() => {
    return files.filter((f) => {
      const blob = [
        f.title,
        f.requestLabel,
        f.teacherDisplayName,
        f.description,
        f.source === "voluntary" ? t("explorerMyTeacherDocVoluntaryBadge") : "",
      ].join(" ");
      return matches(blob, searchQuery);
    });
  }, [files, searchQuery, t]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 px-6 py-14 text-center text-sm text-muted-foreground dark:bg-muted/15">
        {t("explorerMyTeacherDocsEmpty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {showTeacherColumn
          ? t("explorerMyTeacherDocsDirectorHint")
          : t("explorerMyTeacherDocsHint")}
      </p>
      <ul className="space-y-2">
        {filtered.map((f) => (
          <li
            key={`${f.source ?? "onboarding"}-${f.requestId}`}
            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium leading-snug">{f.requestLabel}</p>
                  {f.source === "voluntary" ? (
                    <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                      {t("explorerMyTeacherDocVoluntaryBadge")}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-muted-foreground">{f.title}</p>
                {showTeacherColumn ? (
                  <p className="text-xs text-muted-foreground">
                    {f.teacherDisplayName}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {f.signedUrl ? (
                <Button type="button" size="sm" variant="secondary" asChild>
                  <a href={f.signedUrl} target="_blank" rel="noreferrer">
                    {t("folderDownload")}
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("folderDownloadUnavailable")}
                </span>
              )}
              {showTeacherColumn ? (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={`/administration/comptes/${f.teacherProfileId}`}>
                    {t("explorerTeacherAccountLink")}
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
