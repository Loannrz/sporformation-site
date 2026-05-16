"use client";

import {
  deleteClassAction,
  updateClassAction,
} from "@/app/actions/classes-admin";
import type { ClassAdminDetail } from "@/lib/data/school";
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
import { Users, CalendarRange } from "lucide-react";

const CLASS_YEAR_MIN = 2015;
const CLASS_YEAR_MAX = 2045;

function initials(firstName: string, lastName: string) {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  const pair = `${a}${b}`.toUpperCase();
  return pair || "?";
}

type Props = {
  locale: AppLocale;
  initial: ClassAdminDetail;
  /** Suppression de classe : réservée au directeur (pédago peut gérer la fiche sans supprimer). */
  canDeleteClass?: boolean;
};

export function ClassAdminDetailForm({
  locale,
  initial,
  canDeleteClass = true,
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
  const [yearStart, setYearStart] = useState(
    initial.academicYearStart ?? 2026,
  );
  const [yearEnd, setYearEnd] = useState(initial.academicYearEnd ?? 2028);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initial.name);
    setDescription(initial.description ?? "");
    setYearStart(initial.academicYearStart ?? 2026);
    setYearEnd(initial.academicYearEnd ?? 2028);
  }, [
    initial.id,
    initial.name,
    initial.description,
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
      <form onSubmit={onSave} className="space-y-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          <div className="flex min-h-0 flex-col gap-6">
            <div className="space-y-2">
              <Label htmlFor="cl-name">{t("nameLabel")} *</Label>
              <Input
                id="cl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 bg-background text-base"
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <Label htmlFor="cl-desc">{t("descLabel")}</Label>
              <Textarea
                id="cl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descPlaceholder")}
                rows={6}
                className="min-h-[168px] flex-1 resize-y bg-background lg:min-h-[220px]"
              />
            </div>
          </div>

          <aside className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-gradient-to-br from-muted/35 via-muted/15 to-transparent p-5 shadow-sm dark:from-muted/25 dark:via-muted/10 dark:to-transparent sm:p-6">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/15 dark:bg-primary/20"
                aria-hidden
              >
                <CalendarRange className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cl-y0">{t("academicYearStartLabel")}</Label>
                    <select
                      id="cl-y0"
                      value={yearStart}
                      onChange={(e) => setYearStart(Number(e.target.value))}
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {yearChoices.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("academicYearHelp")}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div
          className={`flex flex-col gap-4 border-t border-border/60 pt-8 sm:flex-row sm:items-center ${error ? "sm:justify-between" : "sm:justify-end"}`}
        >
          {error ? (
            <p className="text-sm text-destructive sm:max-w-xl lg:max-w-2xl" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="w-full sm:w-auto sm:min-w-[11rem]"
          >
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/35 px-5 py-3.5 dark:bg-muted/15">
          <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <h2 className="text-base font-semibold">{t("studentsTitle")}</h2>
        </div>
        {initial.students.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {t("noStudents")}
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {initial.students.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/etudiants/${s.id}`}
                  className="group flex items-center justify-between gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-muted/45 sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold uppercase text-primary ring-1 ring-primary/15 dark:bg-primary/20"
                      aria-hidden
                    >
                      {initials(s.firstName, s.lastName)}
                    </span>
                    <span className="truncate font-medium">
                      {s.firstName} {s.lastName}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary opacity-90 transition group-hover:opacity-100">
                    {t("openStudent")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canDeleteClass ? (
      <section className="rounded-2xl border border-destructive/35 bg-gradient-to-br from-destructive/[0.06] to-transparent p-5 shadow-sm dark:from-destructive/10">
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
      ) : null}
    </div>
  );
}
