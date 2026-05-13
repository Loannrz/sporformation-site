"use client";

import {
  deleteClassAction,
  updateClassAction,
} from "@/app/actions/classes-admin";
import type { ClassAdminDetail, ClassPrincipalOption } from "@/lib/data/school";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/i18n/routing";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState, useTransition, useEffect, useMemo, type FormEvent } from "react";

const CLASS_YEAR_MIN = 2015;
const CLASS_YEAR_MAX = 2045;

type Props = {
  locale: AppLocale;
  initial: ClassAdminDetail;
  principalOptions: ClassPrincipalOption[];
};

export function ClassAdminDetailForm({
  locale,
  initial,
  principalOptions,
}: Props) {
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
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [principalId, setPrincipalId] = useState<string | null>(
    initial.principalId,
  );
  const [yearStart, setYearStart] = useState(
    initial.academicYearStart ?? 2026,
  );
  const [yearEnd, setYearEnd] = useState(initial.academicYearEnd ?? 2028);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initial.name);
    setDescription(initial.description ?? "");
    setPrincipalId(initial.principalId);
    setYearStart(initial.academicYearStart ?? 2026);
    setYearEnd(initial.academicYearEnd ?? 2028);
  }, [
    initial.id,
    initial.name,
    initial.description,
    initial.principalId,
    initial.academicYearStart,
    initial.academicYearEnd,
  ]);

  const mapErr = (code: string) => {
    if (code === "FORBIDDEN") return t("errorForbidden");
    if (code === "NO_SERVICE_ROLE") return t("errorNoServiceRole");
    if (code === "NAME_REQUIRED") return t("errorName");
    if (code === "INVALID_PRINCIPAL") return t("errorInvalidPrincipal");
    if (code === "ACADEMIC_YEARS_INVALID") return t("errorAcademicYears");
    return code;
  };

  const onSave = (e: FormEvent) => {
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
      const res = await updateClassAction(locale, initial.id, {
        name,
        description: description.trim() || null,
        principalId: principalId || null,
        academicYearStart: yearStart,
        academicYearEnd: yearEnd,
      });
      if (!res.ok) {
        const msg = mapErr(String(res.error));
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(t("savedToast"));
      router.refresh();
    });
  };

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteClassAction(locale, initial.id);
      if (!res.ok) {
        const msg = mapErr(String(res.error));
        toast.error(msg);
        return;
      }
      toast.success(t("deletedToast"));
      router.push(`/administration/classes`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={onSave} className="space-y-6">
        <div className="grid gap-4 sm:max-w-xl">
          <div className="space-y-2">
            <Label htmlFor="cl-name">{t("nameLabel")} *</Label>
            <Input
              id="cl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cl-desc">{t("descLabel")}</Label>
            <Textarea
              id="cl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descPlaceholder")}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cl-y0">{t("academicYearStartLabel")}</Label>
              <select
                id="cl-y0"
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
              <Label htmlFor="cl-y1">{t("academicYearEndLabel")}</Label>
              <select
                id="cl-y1"
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
          <div className="space-y-2">
            <Label htmlFor="cl-pp">{t("principalLabel")}</Label>
            <select
              id="cl-pp"
              value={principalId ?? ""}
              onChange={(e) =>
                setPrincipalId(e.target.value ? e.target.value : null)
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("principalNone")}</option>
              {principalOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("principalHelp")}</p>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("studentsTitle")}</h2>
        {initial.students.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
        ) : (
          <ul className="divide-y rounded-lg border border-border">
            {initial.students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/etudiants/${s.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm transition hover:bg-muted/50"
                >
                  <span>
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="text-primary">{t("openStudent")} →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-lg font-semibold text-destructive">
          {t("deleteClass")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("deleteWarn")}</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="destructive"
              className="mt-4"
              disabled={pending}
            >
              {t("deleteConfirm")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("deleteClass")}</AlertDialogTitle>
              <AlertDialogDescription>{t("deleteWarn")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={onDelete}
              >
                {t("deleteConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
