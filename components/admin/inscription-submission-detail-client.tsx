"use client";

import {
  SubmissionDefinitionWalker,
  SubmissionExtraAnswersAndFiles,
} from "@/components/admin/inscription-submission-definition-view";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/i18n/routing";
import type { InscriptionSubmissionAdminRow } from "@/lib/data/inscription-submissions-admin";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Lightbulb,
  Mail,
  MessageSquare,
  SendHorizontal,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

function formatDt(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return format(d, "dd/MM/yyyy HH:mm", { locale: locale === "en" ? enUS : fr });
  } catch {
    return iso;
  }
}

export function InscriptionSubmissionDetailClient({
  locale,
  submissionId,
  initial,
}: {
  locale: AppLocale;
  submissionId: string;
  initial: InscriptionSubmissionAdminRow;
}) {
  const t = useTranslations("admin.inscriptionSubmissions");
  const router = useRouter();
  const [row, setRow] = useState(initial);
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [requestEditsOpen, setRequestEditsOpen] = useState(false);
  const [requestNoticeDraft, setRequestNoticeDraft] = useState("");

  const decisionValidated = row.admin_review_status === "accepted";
  const canSetDecision = row.status === "submitted";

  const patch = useCallback(
    async (
      payload: Record<string, unknown>,
      options?: { redirectTo?: string },
    ) => {
      setPending(true);
      try {
        const res = await fetch(`/api/admin/inscription-submissions/${submissionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP_${res.status}`);
        if (options?.redirectTo) {
          router.push(options.redirectTo);
        } else {
          if (typeof (data as { item?: unknown }).item === "object" && data.item !== null) {
            setRow(data.item as InscriptionSubmissionAdminRow);
          }
          router.refresh();
        }
      } finally {
        setPending(false);
      }
    },
    [router, submissionId],
  );

  const setDecision = (admin_review_status: "pending" | "accepted") => {
    void patch(
      {
        action: "review",
        admin_review_status,
      },
      admin_review_status === "accepted"
        ? { redirectTo: "/admin/inscription-submissions" }
        : undefined,
    );
  };

  const patchFieldReview = (fieldId: string, ok: boolean, message?: string) => {
    void patch({
      action: "fieldReview",
      fieldId,
      ok,
      message: message ?? null,
    });
  };

  const suggestedPortalNotice = useMemo(() => {
    const msgs = Object.entries(row.admin_field_flags)
      .map(([, v]) => v.message?.trim())
      .filter((s): s is string => Boolean(s));
    return msgs.join("\n\n");
  }, [row.admin_field_flags]);

  useEffect(() => {
    if (requestEditsOpen) {
      setRequestNoticeDraft(
        row.candidate_revision_notice?.trim() || suggestedPortalNotice || "",
      );
    }
  }, [requestEditsOpen, row.candidate_revision_notice, suggestedPortalNotice]);

  const runRequestCandidateEdits = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/inscription-submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "requestCandidateEdits",
          candidateRevisionNotice: requestNoticeDraft.trim() || null,
        }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = (data as { error?: string }).error ?? "";
        if (code === "NO_FIELD_FLAGS") {
          toast.error(t("requestCandidateEditsErrorNoFlags"));
        } else {
          toast.error(t("requestCandidateEditsErrorGeneric"));
        }
        return;
      }
      if (typeof (data as { item?: unknown }).item === "object" && data.item !== null) {
        setRow(data.item as InscriptionSubmissionAdminRow);
      }
      setRequestEditsOpen(false);
      toast.success(t("requestCandidateEditsSuccess"));
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const destroySubmission = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/admin/inscription-submissions/${submissionId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error((data as { error?: string }).error ?? `HTTP_${res.status}`);
      toast.success(t("deleteSubmissionSuccess"));
      setDeleteOpen(false);
      router.push("/admin/inscription-submissions");
      router.refresh();
    } catch {
      toast.error(t("deleteSubmissionError"));
    } finally {
      setPending(false);
    }
  };

  const hasFormation = Boolean(row.formation_slug?.trim());
  const hasVille = Boolean(row.ville_slug?.trim());
  const fieldIssueCount = Object.keys(row.admin_field_flags ?? {}).length;
  const canRequestEdits = fieldIssueCount > 0 && !pending;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-md">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/15 via-background to-accent/12 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border">
              <ClipboardList className="size-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight">{t("playbookTitle")}</h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{t("playbookBullet1")}</span>
                </li>
                <li className="flex gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <span>{t("playbookBullet2")}</span>
                </li>
                <li className="flex gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
                  <span>{t("playbookBullet3")}</span>
                </li>
              </ul>
            </div>
          </div>
          {fieldIssueCount > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-400/55 bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-950 dark:text-amber-50">
              <span className="inline-flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t("fieldIssuesBanner", { count: fieldIssueCount })}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-[1fr,minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <User className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("identitySectionTitle")}
              </div>
              <p className="mt-1 text-lg font-semibold leading-snug">
                {[row.candidate_prenom?.trim(), row.candidate_nom?.trim()].filter(Boolean).join(" ").trim() ||
                  t("identityNameUnset")}
              </p>
              <div className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                {t("identityFormEmailLabel")}
              </div>
              {row.candidate_email?.trim() ? (
                <a
                  href={`mailto:${row.candidate_email.trim()}`}
                  className="mt-1 block break-all text-lg font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {row.candidate_email.trim()}
                </a>
              ) : (
                <p className="mt-1 text-lg font-semibold text-muted-foreground">{t("identityEmailUnset")}</p>
              )}
              {row.portal_email?.trim() &&
              (row.candidate_email?.trim() ?? "").toLowerCase() !==
                row.portal_email.trim().toLowerCase() ? (
                <p className="mt-2 max-w-prose text-xs text-muted-foreground">
                  {t("identityPortalHint", { email: row.portal_email.trim() })}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {hasFormation || hasVille ? (
            <div className="sm:col-span-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("routingSummary")}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-medium">
                {hasFormation ? (
                  <span>
                    {t("formation")} · {row.formation_slug}
                  </span>
                ) : null}
                {hasFormation && hasVille ? <span className="text-muted-foreground">·</span> : null}
                {hasVille ? (
                  <span>
                    {t("ville")} · {row.ville_slug}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 sm:col-span-2">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("templateTitle")}
              </div>
              <div className="leading-snug font-medium">{row.template_title}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-border/60 px-3 py-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("updatedAt")}
              </div>
              <div className="font-medium tabular-nums">{formatDt(row.updated_at, locale)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-border/60 px-3 py-2">
            <SendHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("submittedAt")}
              </div>
              <div className="font-medium tabular-nums">{formatDt(row.submitted_at, locale)}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-primary/5 px-3 py-2 sm:col-span-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("progress")}
              </div>
              <div className="text-base font-semibold tabular-nums">{row.progress_computed_percent}%</div>
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/50 bg-gradient-to-r from-muted/45 to-muted/10 px-5 py-4 md:px-6 md:py-5">
          <h2 className="text-lg font-semibold tracking-tight">{t("dossierContent")}</h2>
        </div>
        <div className="bg-muted/15 p-4 md:p-6">
          <SubmissionDefinitionWalker
            definition={row.template_definition}
            answers={row.answers}
            files={row.files}
            locale={locale}
            readOnly={false}
            fieldReviewMap={row.admin_field_flags}
            perFieldReview={row.status === "submitted"}
            reviewPending={pending}
            onFieldReview={patchFieldReview}
          />
          <div className="mt-6">
            <SubmissionExtraAnswersAndFiles
              definition={row.template_definition}
              answers={row.answers}
              files={row.files}
              fieldReviewMap={row.admin_field_flags}
              perFieldReview={row.status === "submitted"}
              reviewPending={pending}
              onFieldReview={patchFieldReview}
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-5 border-b border-border/55 bg-muted/30 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t("adminDecisionStripTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("decisionStripSubtitle")}</p>
            {!canSetDecision ? (
              <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-50">{t("decisionAwaitSubmit")}</p>
            ) : null}
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-border/70 bg-background p-0.5 shadow-inner">
              <Button
                type="button"
                size="sm"
                variant={!decisionValidated ? "default" : "outline"}
                className={cn(
                  "!h-11 shrink-0 rounded-lg px-4",
                  !decisionValidated &&
                    "bg-slate-800 text-white hover:bg-slate-800 hover:text-white dark:bg-neutral-900 dark:text-neutral-50",
                )}
                disabled={pending || !canSetDecision || !decisionValidated}
                onClick={() => setDecision("pending")}
              >
                {t("decisionPending")}
              </Button>
            </div>
            <Button
              type="button"
              size="lg"
              variant="default"
              className={cn(
                "h-11 min-h-[2.75rem] gap-2 rounded-xl px-6 font-semibold shadow-md sm:min-w-[17rem]",
                decisionValidated
                  ? "bg-emerald-600 text-emerald-50 hover:bg-emerald-600 hover:text-emerald-50 dark:bg-emerald-600 dark:hover:bg-emerald-600 dark:hover:text-emerald-50"
                  : "bg-emerald-600 text-emerald-50 ring-2 ring-emerald-500/40 hover:bg-emerald-700 hover:text-emerald-50 dark:ring-emerald-400/30",
              )}
              disabled={pending || !canSetDecision || decisionValidated}
              onClick={() => setDecision("accepted")}
            >
              <CheckCircle2 className="size-5 shrink-0" aria-hidden />
              {t("decisionValidateDossier")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 md:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={!canRequestEdits}
            title={fieldIssueCount === 0 ? t("requestCandidateEditsNeedsFlagsShort") : undefined}
            className="gap-2 border-amber-500/45 bg-amber-500/5 text-amber-950 hover:bg-amber-500/12 dark:text-amber-50"
            onClick={() => setRequestEditsOpen(true)}
          >
            <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
            {t("requestCandidateEdits")}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="gap-2 border-destructive/45 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            {t("deleteSubmission")}
          </Button>
          <AlertDialog open={deleteOpen} onOpenChange={(open) => !pending && setDeleteOpen(open)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteSubmissionTitle")}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block font-medium text-foreground">{row.portal_email?.trim() || "—"}</span>
                  <span>{t("deleteSubmissionDescription")}</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    void destroySubmission();
                  }}
                >
                  {t("deleteSubmissionConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <AlertDialog open={requestEditsOpen} onOpenChange={(o) => !pending && setRequestEditsOpen(o)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("requestCandidateEditsTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-left">
              <span className="block text-foreground">{t("requestCandidateEditsLead")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="candidate-revision-msg">{t("requestCandidateEditsNoticeLabel")}</Label>
            <Textarea
              id="candidate-revision-msg"
              rows={8}
              className="resize-y text-sm leading-relaxed"
              value={requestNoticeDraft}
              onChange={(e) => setRequestNoticeDraft(e.target.value)}
              disabled={pending}
              placeholder={t("requestCandidateEditsPlaceholder")}
            />
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
            <Button
              type="button"
              className="bg-amber-600 text-amber-50 hover:bg-amber-600/90 dark:text-amber-50"
              disabled={pending}
              onClick={() => void runRequestCandidateEdits()}
            >
              {t("requestCandidateEditsConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
