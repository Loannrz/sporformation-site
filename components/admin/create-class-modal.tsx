"use client";

import { createClassAction } from "@/app/actions/classes-admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState, useTransition, useMemo, type FormEvent } from "react";

const CLASS_YEAR_MIN = 2015;
const CLASS_YEAR_MAX = 2045;

type Props = { locale: AppLocale };

export function CreateClassModal({ locale }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.classManage");
  const yearChoices = useMemo(
    () =>
      Array.from(
        { length: CLASS_YEAR_MAX - CLASS_YEAR_MIN + 1 },
        (_, i) => CLASS_YEAR_MIN + i,
      ),
    [],
  );
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yearStart, setYearStart] = useState(2026);
  const [yearEnd, setYearEnd] = useState(2028);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setYearStart(2026);
    setYearEnd(2028);
    setError(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("errorName"));
      return;
    }
    if (yearStart > yearEnd) {
      setError(t("errorAcademicYears"));
      return;
    }
    startTransition(async () => {
      const res = await createClassAction(locale, {
        name,
        description: description.trim() || null,
        academicYearStart: yearStart,
        academicYearEnd: yearEnd,
      });
      if (!res.ok) {
        setError(
          res.error === "FORBIDDEN"
            ? t("errorForbidden")
            : res.error === "NO_SERVICE_ROLE"
              ? t("errorNoServiceRole")
              : res.error === "ACADEMIC_YEARS_INVALID"
                ? t("errorAcademicYears")
                : typeof res.error === "string"
                  ? res.error
                  : t("errorGeneric"),
        );
        return;
      }
      toast.success(t("createdToast"));
      setOpen(false);
      reset();
      router.push(`/administration/classes/${res.id}`);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="gap-2 rounded-xl px-5 shadow-md">
          <Plus className="h-4 w-4" aria-hidden />
          {t("createButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-name">{t("nameLabel")} *</Label>
            <Input
              id="cc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-desc">{t("descLabel")}</Label>
            <Textarea
              id="cc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descPlaceholder")}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-y0">{t("academicYearStartLabel")}</Label>
              <select
                id="cc-y0"
                value={yearStart}
                onChange={(e) => setYearStart(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {yearChoices.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-y1">{t("academicYearEndLabel")}</Label>
              <select
                id="cc-y1"
                value={yearEnd}
                onChange={(e) => setYearEnd(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {yearChoices.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("academicYearHelp")}</p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
