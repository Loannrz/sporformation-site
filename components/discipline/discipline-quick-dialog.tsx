"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type { DisciplineDialogOptions } from "@/lib/data/school";
import { SANCTION_FORM_TYPES_ORDER } from "@/lib/discipline-types";
import { addDisciplineReportsAction } from "@/app/actions/sanctions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  options: DisciplineDialogOptions;
  iconOnly: boolean;
  linkCls: (active: boolean, iconOnly: boolean) => string;
  onMobileNavDismiss?: () => void;
};

export function DisciplineQuickDialog({
  options,
  iconOnly,
  linkCls,
  onMobileNavDismiss,
}: Props) {
  const tNav = useTranslations("nav");
  const t = useTranslations("disciplineShortcut");
  const tTypes = useTranslations("sanctions.types");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"student" | "class">("student");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { sortedClasses, studentsByClass } = useMemo(() => {
    const sorted = [...options.classes].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const map = new Map<string | null, typeof options.students>();
    for (const s of options.students) {
      const k = s.classId;
      const list = map.get(k) ?? [];
      list.push(s);
      map.set(k, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(
          `${b.lastName} ${b.firstName}`,
        ),
      );
    }
    return { sortedClasses: sorted, studentsByClass: map };
  }, [options]);

  function openDialog() {
    onMobileNavDismiss?.();
    setError(null);
    setOpen(true);
  }

  return (
    <>
      {iconOnly ? (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={linkCls(false, iconOnly)}
              aria-label={tNav("warnings")}
              onClick={openDialog}
            >
              <span className="relative shrink-0">
                <AlertTriangle className="h-4 w-4 opacity-80" />
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{tNav("warnings")}</TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          className={linkCls(false, iconOnly)}
          onClick={openDialog}
        >
          <span className="relative shrink-0">
            <AlertTriangle className="h-4 w-4 opacity-80" />
          </span>
          <span className="min-w-0 truncate">{tNav("warnings")}</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData(e.currentTarget);
              startTransition(() => {
                addDisciplineReportsAction(fd)
                  .then(() => setOpen(false))
                  .catch((err) => {
                    setError(
                      err instanceof Error ? err.message : t("errorGeneric"),
                    );
                  });
              });
            }}
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="scope" value={scope} />

            <div className="space-y-2">
              <Label>{t("targetLabel")}</Label>
              <div
                className={cn(
                  "flex gap-2 rounded-lg border border-border bg-muted/30 p-1",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    scope === "student"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setScope("student")}
                >
                  {t("scopeStudent")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    scope === "class"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setScope("class")}
                >
                  {t("scopeClass")}
                </button>
              </div>
            </div>

            {scope === "student" ? (
              <div className="space-y-2">
                <Label htmlFor="dq-student">{t("studentLabel")}</Label>
                <select
                  id="dq-student"
                  name="studentId"
                  required
                  disabled={options.students.length === 0}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t("selectStudentPlaceholder")}
                  </option>
                  {sortedClasses.map((c) => {
                    const studs = studentsByClass.get(c.id);
                    if (!studs?.length) return null;
                    return (
                      <optgroup key={c.id} label={c.name}>
                        {studs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.lastName} {s.firstName}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  {(studentsByClass.get(null) ?? []).length > 0 ? (
                    <optgroup label={t("noClassGroup")}>
                      {(studentsByClass.get(null) ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.lastName} {s.firstName}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="dq-class">{t("classLabel")}</Label>
                <select
                  id="dq-class"
                  name="classId"
                  required
                  disabled={sortedClasses.length === 0}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                  defaultValue=""
                >
                  <option value="" disabled>
                    {t("selectClassPlaceholder")}
                  </option>
                  {sortedClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {t("classBulkHint")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dq-type">{t("typeLabel")}</Label>
              <select
                id="dq-type"
                name="type"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                defaultValue="avertissement"
              >
                {SANCTION_FORM_TYPES_ORDER.map((ty) => (
                  <option key={ty} value={ty}>
                    {tTypes(ty)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dq-desc">{t("detailLabel")}</Label>
              <Textarea
                id="dq-desc"
                name="description"
                required
                minLength={4}
                className="min-h-[120px]"
                placeholder={t("detailPlaceholder")}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t("saving") : t("submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
