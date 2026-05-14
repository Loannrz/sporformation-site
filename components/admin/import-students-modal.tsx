"use client";

import { useState, useTransition, useMemo, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { adminClassOptionLabel } from "@/lib/academic-year-display";
import type { AdminClassOption } from "@/lib/data/school";
import {
  parseStudentsXlsxAction,
  commitStudentsXlsxImportAction,
  type ImportCandidate,
  type ImportConflict,
  type ConflictResolution,
} from "@/app/actions/students-import";

type Props = {
  locale: AppLocale;
  classOptions: AdminClassOption[];
};

type Step = "upload" | "preview" | "resolve" | "done";

export function ImportStudentsModal({ locale, classOptions }: Props) {
  const t = useTranslations("admin.students");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("upload");
  const [classId, setClassId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<
    Record<string, ConflictResolution>
  >({});

  const [error, setError] = useState<string | null>(null);

  const conflictKeys = useMemo(
    () => new Set(conflicts.map((c) => String(c.candidate.rowIndex))),
    [conflicts],
  );

  const counts = useMemo(() => {
    const total = candidates.length;
    const dup = conflicts.length;
    const directCreates = total - dup;
    let willCreate = directCreates;
    let willReplace = 0;
    let willSkip = 0;
    for (const c of conflicts) {
      const r = resolutions[String(c.candidate.rowIndex)];
      if (r === "REPLACE") willReplace += 1;
      else if (r === "KEEP_EXISTING") willSkip += 1;
      else willSkip += 1; // par défaut → skip
    }
    return { total, dup, willCreate, willReplace, willSkip, directCreates };
  }, [candidates, conflicts, resolutions]);

  const reset = () => {
    setStep("upload");
    setClassId("");
    setFile(null);
    setCandidates([]);
    setConflicts([]);
    setWarnings([]);
    setResolutions({});
    setError(null);
  };

  const mapErr = (code: string): string => {
    const map: Record<string, string> = {
      FORBIDDEN: t("importErrorForbidden"),
      NO_SERVICE_ROLE: t("importErrorNoServiceRole"),
      CLASS_REQUIRED: t("importErrorClassRequired"),
      FILE_REQUIRED: t("importErrorFileRequired"),
      FILE_TOO_LARGE: t("importErrorFileTooLarge"),
      CLASS_NOT_FOUND: t("importErrorClassNotFound"),
      PARSE_FAILED: t("importErrorParseFailed"),
      EMPTY_WORKBOOK: t("importErrorEmptyWorkbook"),
      EMPTY_SHEET: t("importErrorEmptySheet"),
      MISSING_NAME_COLUMNS: t("importErrorMissingNameColumns"),
    };
    return map[code] ?? code;
  };

  const onAnalyze = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!classId) {
      setError(t("importErrorClassRequired"));
      return;
    }
    if (!file) {
      setError(t("importErrorFileRequired"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("importErrorFileTooLarge"));
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("classId", classId);
      fd.append("file", file);
      const res = await parseStudentsXlsxAction(fd);
      if (!res.ok) {
        setError(mapErr(res.error));
        return;
      }
      setCandidates(res.candidates);
      setConflicts(res.conflicts);
      setWarnings(res.warnings);
      const defaults: Record<string, ConflictResolution> = {};
      for (const c of res.conflicts) {
        defaults[String(c.candidate.rowIndex)] = "KEEP_EXISTING";
      }
      setResolutions(defaults);
      setStep("preview");
    });
  };

  const onCommit = () => {
    setError(null);
    startTransition(async () => {
      const conflictExistingIds: Record<string, string> = {};
      for (const c of conflicts) {
        conflictExistingIds[String(c.candidate.rowIndex)] = c.existing.id;
      }
      const res = await commitStudentsXlsxImportAction(locale, {
        classId,
        candidates,
        resolutions,
        conflictExistingIds,
      });
      if (!res.ok) {
        setError(mapErr(res.error));
        toast.error(mapErr(res.error));
        return;
      }
      toast.success(
        t("importDoneToast", {
          created: res.created,
          updated: res.updated,
          skipped: res.skipped,
        }),
      );
      setStep("done");
      router.refresh();
    });
  };

  /* --- Rendu --- */

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="default"
          className="gap-2 rounded-xl px-5 shadow-md"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          {t("importButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="grid h-[min(92vh,920px)] max-h-[min(92vh,920px)] w-[calc(100vw-1.25rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:w-full">
        <div className="flex shrink-0 flex-col gap-1 border-b border-border/60 px-5 pb-4 pt-5 sm:px-8 sm:pb-5 sm:pt-6">
          <DialogTitle className="text-left">{t("importTitle")}</DialogTitle>
          <DialogDescription className="text-left">
            {t("importHint")}
          </DialogDescription>
        </div>

        <div className="flex h-full min-h-0 flex-col overflow-hidden px-5 pb-5 pt-4 sm:px-8 sm:pb-6">
          {step === "upload" ? (
            <form
              onSubmit={onAnalyze}
              className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden"
            >
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-2">
                  <Label htmlFor="im-cl">{t("importClassLabel")} *</Label>
                  <select
                    id="im-cl"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t("importClassPlaceholder")}</option>
                    {classOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {adminClassOptionLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="im-file">{t("importFileLabel")} *</Label>
                  <Input
                    id="im-file"
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("importFileHint")}
                  </p>
                </div>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/70 bg-background pt-4 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  <Upload className="mr-2 h-4 w-4" aria-hidden />
                  {pending ? t("importAnalyzing") : t("importAnalyze")}
                </Button>
              </DialogFooter>
            </form>
          ) : null}

          {step === "preview" ? (
            <div className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm dark:bg-muted/10">
                  <p className="font-medium">
                    {t("importPreviewSummary", {
                      total: counts.total,
                      toCreate: counts.directCreates,
                      duplicates: counts.dup,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("importPreviewHint")}
                  </p>
                </div>

                {warnings.length ? (
                  <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="mb-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      {t("importWarningsTitle")}
                    </p>
                    <ul className="ml-5 list-disc space-y-0.5">
                      {warnings.slice(0, 8).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                      {warnings.length > 8 ? (
                        <li>
                          {t("importWarningsMore", {
                            n: warnings.length - 8,
                          })}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("importPreviewListTitle")}
                  </p>
                  <div className="max-h-[min(52vh,520px)] overflow-auto rounded-lg border border-border/70 shadow-inner">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="sticky top-0 z-[1] bg-muted/95 backdrop-blur-sm text-xs uppercase tracking-wide text-muted-foreground shadow-[0_1px_0_0_hsl(var(--border))]">
                        <tr>
                          <th className="px-3 py-2.5 text-left">
                            {t("lastNameLabel")}
                          </th>
                          <th className="px-3 py-2.5 text-left">
                            {t("firstNameLabel")}
                          </th>
                          <th className="px-3 py-2.5 text-left">
                            {t("emailLabel")}
                          </th>
                          <th className="px-3 py-2.5 text-left">{t("extNjs")}</th>
                          <th className="px-3 py-2.5 text-left">
                            {t("importStatusColumn")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c) => {
                          const isDup = conflictKeys.has(String(c.rowIndex));
                          return (
                            <tr
                              key={c.rowIndex}
                              className="border-t border-border/50"
                            >
                              <td className="px-3 py-2">{c.lastName}</td>
                              <td className="px-3 py-2">{c.firstName}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {c.email ?? "—"}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {c.extended.njs ?? "—"}
                              </td>
                              <td className="px-3 py-2">
                                {isDup ? (
                                  <Badge
                                    variant="outline"
                                    className="border-destructive/40 bg-destructive/10 font-normal text-destructive"
                                  >
                                    {t("importStatusDuplicate")}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="font-normal"
                                  >
                                    {t("importStatusNew")}
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/70 bg-background pt-4 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("upload")}
                >
                  {t("importBack")}
                </Button>
                {conflicts.length > 0 ? (
                  <Button type="button" onClick={() => setStep("resolve")}>
                    {t("importResolveDuplicates", { n: conflicts.length })}
                  </Button>
                ) : (
                  <Button type="button" onClick={onCommit} disabled={pending}>
                    {pending
                      ? t("importImporting")
                      : t("importConfirm", {
                          count: counts.directCreates + counts.willReplace,
                        })}
                  </Button>
                )}
              </DialogFooter>
            </div>
          ) : null}

          {step === "resolve" ? (
            <div className="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
                <div className="rounded-xl border border-destructive/40 bg-destructive/[0.06] p-4 text-sm dark:bg-destructive/10">
                  <p className="font-medium text-destructive">
                    {t("importDuplicatesTitle", { n: conflicts.length })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("importDuplicatesHint")}
                  </p>
                </div>

                <ul className="space-y-4">
                  {conflicts.map((cf) => {
                    const key = String(cf.candidate.rowIndex);
                    const choice = resolutions[key] ?? "KEEP_EXISTING";
                    const reasonLabel = cf.reasons
                      .map((r) =>
                        r === "NAME"
                          ? t("importDupReasonName")
                          : t("importDupReasonNjs"),
                      )
                      .join(" + ");
                    return (
                      <li
                        key={key}
                        className="rounded-xl border border-border/70 p-4 shadow-sm"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {cf.candidate.lastName} {cf.candidate.firstName}
                          </p>
                          <Badge variant="outline" className="font-normal">
                            {t("importDupReason")}: {reasonLabel}
                          </Badge>
                        </div>
                        <div className="grid gap-3 text-xs sm:grid-cols-2">
                          <div className="rounded-lg border border-border/60 bg-muted/15 p-3 dark:bg-muted/10">
                            <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("importExistingHeader")}
                            </p>
                            <p>
                              {cf.existing.lastName} {cf.existing.firstName}
                            </p>
                            <p className="mt-0.5 text-muted-foreground">
                              {cf.existing.email ?? "—"}
                            </p>
                            <p className="text-muted-foreground">
                              {t("birthDateLabel")} :{" "}
                              {cf.existing.birthDate ?? "—"}
                            </p>
                            <p className="text-muted-foreground">
                              NJS : {cf.existing.njs ?? "—"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3 dark:bg-primary/10">
                            <p className="mb-1 font-semibold uppercase tracking-wide text-primary">
                              {t("importNewHeader")}
                            </p>
                            <p>
                              {cf.candidate.lastName} {cf.candidate.firstName}
                            </p>
                            <p className="mt-0.5 text-muted-foreground">
                              {cf.candidate.email ?? "—"}
                            </p>
                            <p className="text-muted-foreground">
                              {t("birthDateLabel")} :{" "}
                              {cf.candidate.birthDate ?? "—"}
                            </p>
                            <p className="text-muted-foreground">
                              NJS : {cf.candidate.extended.njs ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`dup-${key}`}
                              checked={choice === "KEEP_EXISTING"}
                              onChange={() =>
                                setResolutions((s) => ({
                                  ...s,
                                  [key]: "KEEP_EXISTING",
                                }))
                              }
                            />
                            {t("importChoiceKeep")}
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`dup-${key}`}
                              checked={choice === "REPLACE"}
                              onChange={() =>
                                setResolutions((s) => ({
                                  ...s,
                                  [key]: "REPLACE",
                                }))
                              }
                            />
                            {t("importChoiceReplace")}
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs dark:bg-muted/10">
                  {t("importResolveSummary", {
                    toCreate: counts.directCreates,
                    toReplace: counts.willReplace,
                    toSkip: counts.willSkip,
                  })}
                </div>
              </div>
              <DialogFooter className="mt-4 shrink-0 gap-2 border-t border-border/70 bg-background pt-4 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("preview")}
                >
                  {t("importBack")}
                </Button>
                <Button type="button" onClick={onCommit} disabled={pending}>
                  {pending
                    ? t("importImporting")
                    : t("importConfirm", {
                        count: counts.directCreates + counts.willReplace,
                      })}
                </Button>
              </DialogFooter>
            </div>
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-sm dark:border-emerald-700/60 dark:bg-emerald-950/30">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  {t("importDoneTitle")}
                </p>
                <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-200/80">
                  {t("importDoneHint")}
                </p>
              </div>
              <DialogFooter className="gap-2 border-t border-border/70 pt-4 sm:justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  <X className="mr-2 h-4 w-4" aria-hidden />
                  {t("importClose")}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
