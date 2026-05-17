"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { inscriptionPublicUploadUrl } from "@/lib/inscription-public-upload-url";
import type { AdminFieldFlagsMap } from "@/lib/data/inscription-submissions-admin";
import {
  collectLeafInputFieldIdsFromDefinition,
  isPresentationOnlyTemplateLeaf,
  isTemplateLeafCollectingUserInput,
  type SubmissionFilesMap,
} from "@/lib/inscription-submission-progress";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

function humanizeSubmissionAnswer(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((item) => humanizeSubmissionAnswer(item))
      .filter((s) => s.length > 0)
      .join(", ");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const key of ["value", "label", "title", "text", "name", "libelle"]) {
      if (key in o && o[key] !== undefined && o[key] !== null) {
        const inner = humanizeSubmissionAnswer(o[key]);
        if (inner) return inner;
      }
    }
    const fragments = Object.values(o)
      .map((part) => humanizeSubmissionAnswer(part))
      .filter((s) => s.length > 0);
    if (fragments.length > 0) {
      return [...new Set(fragments)].join(", ");
    }
  }
  return "";
}

/**
 * Réponses lisibles sans crochets / guillemets JSON lorsque c’est possible
 * (`["Oui"]` → prose `Oui`). Mode `code` réservé aux objets non simplifiables.
 */
export function resolveSubmissionAnswerDisplay(v: unknown): {
  text: string;
  mode: "prose" | "code";
} {
  const human = humanizeSubmissionAnswer(v);
  if (human.trim().length > 0) {
    return { text: human.trim(), mode: "prose" };
  }

  const needsDump =
    v !== null &&
    v !== undefined &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.keys(v as object).length > 0;
  if (needsDump) {
    return {
      text: JSON.stringify(v, null, 2),
      mode: "code",
    };
  }

  return { text: "", mode: "prose" };
}

/** Compatibilité : même chaîne que `resolveSubmissionAnswerDisplay`…`text`. */
export function stringifyAnswerInline(v: unknown): string {
  return resolveSubmissionAnswerDisplay(v).text;
}

/** @deprecated utilisez collectLeafInputFieldIdsFromDefinition (même comportement). */
export const collectLeafFieldIdsFromDefinition = collectLeafInputFieldIdsFromDefinition;

function submissionNodeShowsInputFieldLeaves(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;
  const blocks = Array.isArray(n.blocks) ? n.blocks : [];
  const fields = Array.isArray(n.fields) ? n.fields : [];
  if (blocks.length > 0 || fields.length > 0) {
    return [...blocks, ...fields].some((c) => submissionNodeShowsInputFieldLeaves(c));
  }
  const id = typeof n.id === "string" ? n.id.trim() : "";
  if (!id) return false;
  return !isPresentationOnlyTemplateLeaf(n);
}

function submissionStepHasInputFields(step: unknown): boolean {
  if (!step || typeof step !== "object") return false;
  const s = step as { blocks?: unknown[]; fields?: unknown[] };
  const blocks = Array.isArray(s.blocks) ? s.blocks : [];
  const fields = Array.isArray(s.fields) ? s.fields : [];
  return [...blocks, ...fields].some((n) => submissionNodeShowsInputFieldLeaves(n));
}

function hintedOrEmpty(s: string): string | undefined {
  const t = s.trim();
  return t.length > 0 ? t : undefined;
}

function FieldRow({
  id: _id,
  title,
  val,
  fileMeta,
  readOnly,
  fieldReviewMap,
  perFieldReview,
  reviewPending,
  onFieldReview,
}: {
  id: string;
  title?: string | null;
  val: unknown;
  fileMeta?: SubmissionFilesMap[string];
  readOnly?: boolean;
  fieldReviewMap?: AdminFieldFlagsMap;
  perFieldReview?: boolean;
  reviewPending?: boolean;
  onFieldReview?: (fieldId: string, ok: boolean, message?: string) => void;
}) {
  const t = useTranslations("admin.inscriptionSubmissions");
  const path = fileMeta?.path != null ? String(fileMeta.path).trim() : "";
  const publicUrl = path ? inscriptionPublicUploadUrl(path) : null;
  const mime =
    typeof fileMeta?.mime === "string" ? fileMeta.mime.toLowerCase() : "";
  const isImage = mime.startsWith("image/");
  const { text: answeredText, mode: answerDisplayMode } = resolveSubmissionAnswerDisplay(val);
  const textTrimmed = answeredText.trim();
  const hasPath = path.length > 0;
  const hasText = textTrimmed.length > 0;

  const flagged = Boolean(fieldReviewMap && Object.prototype.hasOwnProperty.call(fieldReviewMap, _id));
  const portalHint = flagged ? fieldReviewMap?.[_id]?.message?.trim() ?? "" : "";

  const [hintDraft, setHintDraft] = useState(portalHint);
  useEffect(() => {
    setHintDraft(portalHint);
  }, [portalHint]);

  const showReviewer = Boolean(perFieldReview && onFieldReview);

  const [copyClicked, setCopyClicked] = useState(false);
  useEffect(() => {
    setCopyClicked(false);
  }, [textTrimmed]);
  const copyAnswerText = async () => {
    if (!textTrimmed) return;
    try {
      await navigator.clipboard.writeText(textTrimmed);
      setCopyClicked(true);
      toast.success(t("copyFieldAnswerSuccess"));
      window.setTimeout(() => setCopyClicked(false), 1800);
    } catch {
      toast.error(t("copyFieldAnswerError"));
    }
  };

  const borderTone = flagged ? "border-amber-500/55 shadow-md shadow-amber-500/15 ring-1 ring-amber-500/30" : "border-border/60 hover:border-border/80";

  return (
    <li className={cn("overflow-hidden rounded-xl border bg-card transition-colors", borderTone)}>
      <div className="flex flex-col gap-3 border-b border-border/35 bg-muted/35 px-4 py-3.5 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-semibold leading-snug">{title ?? t("fieldFallbackLabel")}</div>
          {flagged ? (
            <p className="text-[11px] font-medium leading-snug text-amber-800 dark:text-amber-100">{t("fieldMarkedNeedsFixChip")}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
          {showReviewer ? (
            <div className="inline-flex overflow-hidden rounded-lg border border-border/70 bg-muted/35 p-0.5 shadow-sm">
              <Button
                type="button"
                size="sm"
                variant={!flagged ? "default" : "outline"}
                className={cn(
                  "!h-9 shrink-0 rounded-md px-3.5",
                  !flagged &&
                    "bg-emerald-600 text-emerald-50 hover:bg-emerald-600/90 hover:text-emerald-50",
                )}
                disabled={reviewPending || !flagged}
                onClick={() => onFieldReview!(_id, true)}
              >
                {t("fieldReviewConform")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={flagged ? "default" : "outline"}
                className={cn(flagged && "bg-amber-600 text-amber-50 hover:bg-amber-600/90 hover:text-amber-50")}
                disabled={reviewPending}
                onClick={() => onFieldReview!(_id, false, hintedOrEmpty(hintDraft))}
              >
                {t("fieldReviewReject")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-border/15 bg-card px-4 py-4 md:py-5">
        {hasPath ? (
          <div className="space-y-3">
            {publicUrl && isImage ? (
              <a href={publicUrl} target="_blank" rel="noreferrer" className="block">
                <Image
                  src={publicUrl}
                  alt=""
                  width={440}
                  height={280}
                  unoptimized
                  className="max-h-56 w-auto max-w-full rounded-lg border bg-muted object-contain shadow-inner"
                />
              </a>
            ) : null}
            {publicUrl ? (
              <a
                href={publicUrl}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary ring-1 ring-inset ring-primary/20 hover:bg-primary/15"
                target="_blank"
                rel="noreferrer"
              >
                {fileMeta?.name?.trim() ? String(fileMeta.name) : t("downloadFile")}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">{path}</span>
            )}
          </div>
        ) : hasText ? (
          answerDisplayMode === "code" ? (
            <div className="flex items-start gap-1.5 sm:gap-2">
              <pre className="max-h-64 min-w-0 flex-1 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
                {textTrimmed}
              </pre>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                aria-label={t("copyFieldAnswer")}
                title={t("copyFieldAnswer")}
                onClick={() => void copyAnswerText()}
              >
                {copyClicked ? (
                  <Check className="size-4 text-emerald-600" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-1.5 sm:gap-2">
              <div className="min-w-0 flex-1 rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {textTrimmed}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                aria-label={t("copyFieldAnswer")}
                title={t("copyFieldAnswer")}
                onClick={() => void copyAnswerText()}
              >
                {copyClicked ? (
                  <Check className="size-4 text-emerald-600" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
              </Button>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/25 py-10 text-center">
            <p className="text-sm font-medium italic text-muted-foreground">{t("emptyField")}</p>
          </div>
        )}
      </div>
      {showReviewer && flagged ? (
        <div className="border-t border-amber-500/35 bg-amber-500/10 px-4 py-4 dark:bg-amber-500/5">
          <Label className="text-xs font-semibold">{t("fieldReviewPortalHint")}</Label>
          <Textarea
            className="mt-2 min-h-[96px] text-sm"
            value={hintDraft}
            onChange={(e) => setHintDraft(e.target.value)}
            placeholder={t("fieldReviewPortalPlaceholder")}
            disabled={reviewPending}
          />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={reviewPending || hintDraft.trim() === portalHint}
              onClick={() => onFieldReview!(_id, false, hintedOrEmpty(hintDraft))}
            >
              {t("fieldReviewSavePortalHint")}
            </Button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t("fieldReviewPortalExplain")}</p>
        </div>
      ) : null}
    </li>
  );
}

function DefinitionNode({
  node,
  answers,
  files,
  readOnly,
  depth = 0,
  fieldReviewMap,
  perFieldReview,
  reviewPending,
  onFieldReview,
}: {
  node: unknown;
  answers: Record<string, unknown>;
  files: SubmissionFilesMap;
  readOnly?: boolean;
  depth?: number;
  fieldReviewMap?: AdminFieldFlagsMap;
  perFieldReview?: boolean;
  reviewPending?: boolean;
  onFieldReview?: (fieldId: string, ok: boolean, message?: string) => void;
}) {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  const id = typeof n.id === "string" ? n.id.trim() : "";
  const title =
    typeof n.title === "string"
      ? n.title
      : typeof n.label === "string"
        ? n.label
        : undefined;
  const blocks = Array.isArray(n.blocks) ? n.blocks : undefined;
  const fields = Array.isArray(n.fields) ? n.fields : undefined;
  const hasNest = Boolean((blocks?.length ?? 0) > 0 || (fields?.length ?? 0) > 0);

  if (hasNest) {
    if (!submissionNodeShowsInputFieldLeaves(node)) return null;
    return (
      <li className={`space-y-3 ${depth > 0 ? "border-l-2 border-primary/25 pl-4" : ""}`}>
        {blocks?.map((b, i) => (
          <DefinitionNode
            key={i}
            node={b}
            answers={answers}
            files={files}
            readOnly={readOnly}
            depth={depth + 1}
            fieldReviewMap={fieldReviewMap}
            perFieldReview={perFieldReview}
            reviewPending={reviewPending}
            onFieldReview={onFieldReview}
          />
        ))}
        {fields?.map((f, j) => (
          <DefinitionNode
            key={j}
            node={f}
            answers={answers}
            files={files}
            readOnly={readOnly}
            depth={depth + 1}
            fieldReviewMap={fieldReviewMap}
            perFieldReview={perFieldReview}
            reviewPending={reviewPending}
            onFieldReview={onFieldReview}
          />
        ))}
      </li>
    );
  }

  if (!id) return null;
  if (isPresentationOnlyTemplateLeaf(n)) return null;

  const flaggedForReview =
    Boolean(fieldReviewMap && Object.prototype.hasOwnProperty.call(fieldReviewMap, id));
  const filePath = files[id]?.path != null ? String(files[id].path).trim() : "";
  const answeredText = resolveSubmissionAnswerDisplay(answers[id]).text.trim();
  const hasContent = filePath.length > 0 || answeredText.length > 0;
  if (!hasContent && !flaggedForReview && !isTemplateLeafCollectingUserInput(n)) {
    return null;
  }

  return (
    <FieldRow
      id={id}
      title={title}
      val={answers[id]}
      fileMeta={files[id]}
      readOnly={readOnly}
      fieldReviewMap={fieldReviewMap}
      perFieldReview={perFieldReview}
      reviewPending={reviewPending}
      onFieldReview={onFieldReview}
    />
  );
}

export function SubmissionDefinitionWalker({
  definition,
  answers,
  files,
  readOnly,
  locale: _locale,
  fieldReviewMap,
  perFieldReview,
  reviewPending,
  onFieldReview,
}: {
  definition: unknown;
  answers: Record<string, unknown>;
  files: SubmissionFilesMap;
  readOnly?: boolean;
  locale: AppLocale;
  fieldReviewMap?: AdminFieldFlagsMap;
  perFieldReview?: boolean;
  reviewPending?: boolean;
  onFieldReview?: (fieldId: string, ok: boolean, message?: string) => void;
}) {
  const t = useTranslations("admin.inscriptionSubmissions");
  void _locale;

  if (!definition || typeof definition !== "object") {
    return <p className="text-sm text-muted-foreground">{t("noTemplateDefinition")}</p>;
  }

  const steps = (definition as { steps?: unknown }).steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    return (
      <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
        {JSON.stringify(definition, null, 2)}
      </pre>
    );
  }

  const stepsWithInputs = steps
    .map((step, idx) => ({ step, idx }))
    .filter(({ step }) => submissionStepHasInputFields(step));

  if (stepsWithInputs.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("walkerNoFillableSteps")}</p>;
  }

  return (
    <div className="space-y-6">
      {stepsWithInputs.map(({ step, idx: originalIdx }, displayIdx) => {
        if (!step || typeof step !== "object") return null;
        const s = step as {
          title?: string;
          blocks?: unknown[];
          fields?: unknown[];
        };
        const stitle =
          typeof s.title === "string" && s.title.trim()
            ? s.title.trim()
            : t("stepN", { n: originalIdx + 1 });

        return (
          <section
            key={originalIdx}
            className="space-y-3 rounded-xl border border-border/65 bg-muted/25 p-4 shadow-sm backdrop-blur-sm md:p-5"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-border/40 pb-3 md:gap-4 md:pb-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow">
                {displayIdx + 1}
              </span>
              <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">{stitle}</h3>
            </div>
            <ul className="space-y-3 md:space-y-4">
              {Array.isArray(s.blocks)
                ? s.blocks.map((b, i) => (
                    <DefinitionNode
                      key={i}
                      node={b}
                      answers={answers}
                      files={files}
                      readOnly={readOnly}
                      fieldReviewMap={fieldReviewMap}
                      perFieldReview={perFieldReview}
                      reviewPending={reviewPending}
                      onFieldReview={onFieldReview}
                    />
                  ))
                : null}
              {Array.isArray(s.fields)
                ? s.fields.map((f, j) => (
                    <DefinitionNode
                      key={`f-${j}`}
                      node={f}
                      answers={answers}
                      files={files}
                      readOnly={readOnly}
                      fieldReviewMap={fieldReviewMap}
                      perFieldReview={perFieldReview}
                      reviewPending={reviewPending}
                      onFieldReview={onFieldReview}
                    />
                  ))
                : null}
              {!s.blocks?.length && !s.fields?.length ? (
                <li className="text-sm text-muted-foreground">{t("stepEmpty")}</li>
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function SubmissionExtraAnswersAndFiles({
  definition,
  answers,
  files,
  fieldReviewMap,
  perFieldReview,
  reviewPending,
  onFieldReview,
}: {
  definition: unknown;
  answers: Record<string, unknown>;
  files: SubmissionFilesMap;
  fieldReviewMap?: AdminFieldFlagsMap;
  perFieldReview?: boolean;
  reviewPending?: boolean;
  onFieldReview?: (fieldId: string, ok: boolean, message?: string) => void;
}) {
  const t = useTranslations("admin.inscriptionSubmissions");
  const declared = collectLeafFieldIdsFromDefinition(definition);

  const extraKeys = [
    ...Object.keys(answers),
    ...Object.keys(files ?? {}),
  ].filter((k, i, a) => a.indexOf(k) === i && !declared.has(k));

  const extraKeysVisible = extraKeys.filter((kid) => {
    const flaggedForReview = Boolean(
      fieldReviewMap && Object.prototype.hasOwnProperty.call(fieldReviewMap, kid),
    );
    if (flaggedForReview) return true;
    const path = files?.[kid]?.path != null ? String(files[kid].path).trim() : "";
    const text = resolveSubmissionAnswerDisplay(answers[kid]).text.trim();
    return path.length > 0 || text.length > 0;
  });

  if (extraKeysVisible.length === 0) return null;

  return (
    <section className="space-y-4 rounded-xl border border-dashed border-amber-500/35 bg-muted/15 p-4">
      <h3 className="text-sm font-semibold">{t("extraFieldsTitle")}</h3>
      <ul className="space-y-4">
        {extraKeysVisible.map((kid) => (
          <FieldRow
            key={kid}
            id={kid}
            title={kid}
            val={answers[kid]}
            fileMeta={files?.[kid]}
            readOnly
            fieldReviewMap={fieldReviewMap}
            perFieldReview={perFieldReview}
            reviewPending={reviewPending}
            onFieldReview={onFieldReview}
          />
        ))}
      </ul>
    </section>
  );
}
