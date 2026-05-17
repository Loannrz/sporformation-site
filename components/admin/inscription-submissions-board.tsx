"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SubmissionDefinitionWalker,
  SubmissionExtraAnswersAndFiles,
} from "@/components/admin/inscription-submission-definition-view";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { InscriptionSubmissionAdminRow } from "@/lib/data/inscription-submissions-admin";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";

function initialsFromPortalEmail(email: string | null | undefined): string {
  const e = email?.trim() ?? "";
  if (!e) return "?";
  const local = (e.split("@")[0] ?? "?").trim();
  const clean = local.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ0-9]/g, "");
  if (!clean.length) return local.slice(0, 1).toUpperCase() || "?";
  return `${clean.slice(0, 1)}${clean.slice(1, 2) ?? ""}`.toUpperCase();
}

function dossierIdentificationName(row: InscriptionSubmissionAdminRow): string | null {
  const p = row.candidate_prenom?.trim() ?? "";
  const n = row.candidate_nom?.trim() ?? "";
  const phrase = [p, n].filter(Boolean).join(" ").trim();
  return phrase.length ? phrase : null;
}

function dossierIdentificationEmail(row: InscriptionSubmissionAdminRow): string | null {
  const e = row.candidate_email?.trim() ?? "";
  return e.length ? e : null;
}

function dossierIdentificationInitials(row: InscriptionSubmissionAdminRow): string {
  const p = row.candidate_prenom?.trim() ?? "";
  const n = row.candidate_nom?.trim() ?? "";
  if (p && n) return `${p[0] ?? ""}${n[0] ?? ""}`.toLocaleUpperCase();
  if ((p ?? "").length >= 2) return p.slice(0, 2).toLocaleUpperCase();
  if (p) return `${(p[0] ?? "").toLocaleUpperCase()}${(p[1] ?? "?").toLocaleUpperCase()}`;
  if ((n ?? "").length >= 2) return n.slice(0, 2).toLocaleUpperCase();
  return initialsFromPortalEmail(dossierIdentificationEmail(row) ?? row.portal_email);
}

function fmtShort(iso: string, locale: AppLocale): string {
  try {
    const d = new Date(iso);
    return locale === "en"
      ? d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
      : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso.slice(0, 16);
  }
}

function renderSubmissionReviewBadge(
  row: InscriptionSubmissionAdminRow,
  t: ReturnType<typeof useTranslations>,
) {
  if (row.admin_review_status == null && row.status === "draft") return null;

  if (
    row.status === "submitted" &&
    (row.admin_review_status === null || row.admin_review_status === "pending")
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
        <Sparkles className="size-3" aria-hidden />
        {t("reviewBadgeBacklog")}
      </span>
    );
  }
  if (row.admin_review_status === "needs_completion") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:text-sky-100">
        {t("reviewBadgeWaitingCand")}
      </span>
    );
  }
  if (row.admin_review_status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-100">
        <CheckCircle2 className="size-3" aria-hidden />
        {t("status.accepted")}
      </span>
    );
  }
  if (row.admin_review_status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 dark:text-rose-100">
        <AlertTriangle className="size-3" aria-hidden />
        {t("status.rejected")}
      </span>
    );
  }
  if (row.admin_review_status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-muted px-2 py-0.5 text-[11px] font-semibold">
        {t("status.pending")}
      </span>
    );
  }
  return null;
}

export function InscriptionSubmissionsBoard({
  rows,
  locale,
  pagination,
  acceptedBulkDeleteEnabled = false,
}: {
  rows: InscriptionSubmissionAdminRow[];
  locale: AppLocale;
  pagination?: ReactNode;
  /** File « Acceptés » : cases à cocher + suppression groupée (page courante). */
  acceptedBulkDeleteEnabled?: boolean;
}) {
  const t = useTranslations("admin.inscriptionSubmissions");
  const router = useRouter();
  const [preview, setPreview] = useState<InscriptionSubmissionAdminRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const rowIdsOnPage = useMemo(() => rows.map((r) => r.id), [rows]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [rowIdsOnPage]);

  const onDialogOpenChange = useCallback((o: boolean) => {
    if (!o) setPreview(null);
  }, []);

  const selectedCount = selectedIds.size;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelectedIds(new Set(rowIdsOnPage));
  }, [rowIdsOnPage]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const runBulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/inscription-submissions/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        deleted?: number;
        skippedNotEligible?: number;
        failed?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(t("deleteSubmissionError"), {
          description: data.error ?? `HTTP_${res.status}`,
        });
        return;
      }
      const deleted = typeof data.deleted === "number" ? data.deleted : 0;
      const skipped = typeof data.skippedNotEligible === "number" ? data.skippedNotEligible : 0;
      const failed = typeof data.failed === "number" ? data.failed : 0;

      if (deleted > 0) {
        toast.success(t("bulkDeleteSuccess", { count: deleted }));
      }
      if (skipped > 0 || failed > 0) {
        toast.message(t("bulkDeletePartial", { skipped, failed }));
      }
      if (deleted === 0 && skipped === 0 && failed === 0) {
        toast.message(t("bulkDeleteNothingDone"));
      }

      clearSelection();
      setBulkConfirmOpen(false);
      setPreview(null);
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  }, [clearSelection, router, selectedIds, t]);

  if (rows.length === 0) {
    return <p className="p-10 text-center text-muted-foreground">{t("emptyList")}</p>;
  }

  return (
    <>
      {acceptedBulkDeleteEnabled ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAllOnPage}>
              {t("bulkSelectAll")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearSelection}
              disabled={selectedCount === 0}
            >
              {t("bulkDeselectAll")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("bulkSelectedCount", { count: selectedCount })}
              {rowIdsOnPage.length ? (
                <span className="text-muted-foreground/80">
                  {" · "}
                  {t("bulkPageHint", { count: rowIdsOnPage.length })}
                </span>
              ) : null}
            </span>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-2 sm:shrink-0"
            disabled={selectedCount === 0 || bulkDeleting}
            onClick={() => setBulkConfirmOpen(true)}
          >
            <Trash2 className="size-4 shrink-0" aria-hidden />
            {t("bulkDeleteSelected")}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <InscriptionSubmissionCard
            key={r.id}
            row={r}
            locale={locale}
            selectionMode={acceptedBulkDeleteEnabled}
            selected={selectedIds.has(r.id)}
            onToggleSelect={() => toggleOne(r.id)}
            onOpen={() => setPreview(r)}
          />
        ))}
      </div>

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulkDeleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulkDeleteConfirmDescription", { count: selectedCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkDeleting || selectedCount === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void runBulkDelete();
              }}
            >
              {bulkDeleting ? "…" : t("bulkDeleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pagination}

      <Dialog open={preview !== null} onOpenChange={onDialogOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,900px)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {preview ? (
            <>
              <DialogHeader className="space-y-3 border-b border-border/60 bg-gradient-to-br from-primary/12 via-background to-accent/15 px-6 py-6 text-left">
                <DialogTitle className="flex items-start gap-2 pr-9 text-xl font-semibold">
                  <User className="mt-1 size-4 shrink-0 text-primary opacity-85" aria-hidden />
                  <span className="min-w-0 flex-1 space-y-2 text-left leading-tight">
                    <span className="block line-clamp-2">
                      {dossierIdentificationName(preview) ?? t("identityNameUnset")}
                    </span>
                    <span className="flex items-start gap-2 text-base font-normal text-muted-foreground">
                      <Mail className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
                      <span className="min-w-0 break-all">
                        {dossierIdentificationEmail(preview) ?? t("identityEmailUnset")}
                      </span>
                    </span>
                    {preview.portal_email?.trim() &&
                    dossierIdentificationEmail(preview)?.toLowerCase() !==
                      preview.portal_email.trim().toLowerCase() ? (
                      <span className="block text-[11px] font-normal leading-snug text-muted-foreground">
                        {t("identityPortalHint", { email: preview.portal_email.trim() })}
                      </span>
                    ) : null}
                  </span>
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={preview.status === "submitted" ? "default" : "secondary"}>
                    {preview.status === "submitted"
                      ? t("portalStatus.submitted")
                      : t("portalStatus.draft")}
                  </Badge>
                  {renderSubmissionReviewBadge(preview, t)}
                </div>
                <div className="flex flex-wrap gap-2 rounded-lg border border-border/50 bg-card/70 px-3 py-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{preview.template_title}</span>
                  {preview.formation_slug?.trim() ? (
                    <span>
                      · {t("formation")} <span className="text-foreground">{preview.formation_slug}</span>
                    </span>
                  ) : null}
                  {preview.ville_slug?.trim() ? (
                    <span>
                      · {t("ville")} <span className="text-foreground">{preview.ville_slug}</span>
                    </span>
                  ) : null}
                </div>
              </DialogHeader>

              <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4 pt-3">
                <div className="grid gap-2 rounded-xl border border-border/55 bg-muted/15 px-3 py-2.5 text-[11px] text-muted-foreground sm:grid-cols-2">
                  <span>
                    {t("previewProgress")}:{" "}
                    <strong className="text-foreground">{preview.progress_computed_percent}%</strong>
                  </span>
                  <span>
                    {t("updatedAtShort")}: {fmtShort(preview.updated_at, locale)}
                  </span>
                  {preview.submitted_at ? (
                    <span className="sm:col-span-2">
                      {t("submittedAtShort")}: {fmtShort(preview.submitted_at, locale)}
                    </span>
                  ) : null}
                </div>

                <SubmissionDefinitionWalker
                  definition={preview.template_definition}
                  answers={preview.answers}
                  files={preview.files}
                  locale={locale}
                  readOnly
                />
                <SubmissionExtraAnswersAndFiles
                  definition={preview.template_definition}
                  answers={preview.answers}
                  files={preview.files}
                />
              </div>

              <DialogFooter className="gap-2 border-t border-border/60 px-5 py-3 sm:justify-stretch">
                <Link
                  href={`/admin/inscription-submissions/${preview.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <FileText className="h-4 w-4 shrink-0" aria-hidden />
                  {t("openFullRecord")}
                </Link>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InscriptionSubmissionCard({
  row,
  locale,
  onOpen,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  row: InscriptionSubmissionAdminRow;
  locale: AppLocale;
  onOpen: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const t = useTranslations("admin.inscriptionSubmissions");
  const fieldIssues = Object.keys(row.admin_field_flags ?? {}).length;
  const badge = renderSubmissionReviewBadge(row, t);
  const nomLigne = dossierIdentificationName(row);
  const formEmail = dossierIdentificationEmail(row);

  return (
    <div className="block w-full text-left">
      <Card
        className={cn(
          "group relative overflow-hidden border-border/85 bg-card shadow-sm transition-[border-color,box-shadow]",
          "hover:border-primary/28 hover:shadow-lg",
          selectionMode && selected && "border-primary ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
        )}
      >
        <div className="h-1 bg-gradient-to-r from-primary/85 to-accent/75" aria-hidden />
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full flex-col text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardHeader className="space-y-3 p-5 pb-3">
            <div className="flex items-start gap-3">
              {selectionMode ? (
                <span className="flex shrink-0 items-start pt-1">
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={() => onToggleSelect?.()}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-input accent-primary"
                    aria-label={t("bulkDeleteCheckboxAria")}
                  />
                </span>
              ) : null}
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[13px] font-semibold text-primary uppercase"
                aria-hidden
              >
                {dossierIdentificationInitials(row)}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <CardTitle className="flex items-start gap-2 text-base font-semibold leading-snug">
                  <User className="mt-0.5 size-3.5 shrink-0 opacity-55" aria-hidden />
                  <span className="line-clamp-2 min-w-0">
                    {nomLigne ?? t("identityNameUnset")}
                  </span>
                </CardTitle>
                <p className="flex items-start gap-2 text-sm font-normal text-muted-foreground">
                  <Mail className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="min-w-0 break-all">
                    {formEmail ?? t("identityEmailUnset")}
                  </span>
                </p>
                {row.portal_email?.trim() &&
                formEmail?.toLowerCase() !== row.portal_email.trim().toLowerCase() ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {t("identityPortalHint", { email: row.portal_email.trim() })}
                  </p>
                ) : null}
              </div>
              <Badge variant={row.status === "submitted" ? "default" : "secondary"} className="shrink-0 text-[11px]">
                {row.status === "submitted" ? t("portalStatus.submitted") : t("portalStatus.draft")}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-2 p-5 pt-0 text-sm">
            {badge ? <div className="flex flex-wrap gap-2">{badge}</div> : null}

            <p className="flex flex-wrap gap-2 pt-2">
              <GraduationCap className="size-4 shrink-0 text-primary/70" aria-hidden />
              <span className="truncate font-medium text-foreground">{row.template_title}</span>
            </p>

            <p className="flex flex-wrap items-start gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-primary/60" aria-hidden />
              <span className="truncate">
                {[row.formation_slug?.trim(), row.ville_slug?.trim()].filter(Boolean).join(" · ") || "—"}
              </span>
            </p>

            {fieldIssues > 0 ? (
              <p className="inline-flex flex-wrap items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-900 dark:text-amber-100">
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                {t("cardFieldIssues", { count: fieldIssues })}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-border/55 pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex tabular-nums font-medium text-foreground">
                {row.progress_computed_percent}% · {t("progressLabel")}
              </span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                {fmtShort(row.updated_at, locale)}
              </span>
              <span className="text-primary underline-offset-2 opacity-0 transition-opacity group-hover:opacity-100">
                {t("openDetail")}
              </span>
              <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
            </div>
          </CardContent>
        </button>

        <Link
          href={`/admin/inscription-submissions/${row.id}`}
          className="flex items-center justify-between gap-3 border-t border-border/65 bg-muted/20 px-4 py-2.5 text-sm font-medium hover:bg-muted/35 hover:underline"
        >
          <span className="inline-flex flex-1 items-center gap-2 truncate">
            <ClipboardList className="size-4 shrink-0 text-primary" aria-hidden />
            {t("openFullRecord")}
          </span>
          <ChevronRight className="size-4 shrink-0 opacity-60" aria-hidden />
        </Link>
      </Card>
    </div>
  );
}
