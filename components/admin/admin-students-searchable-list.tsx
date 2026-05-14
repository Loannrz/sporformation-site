"use client";

import { deleteStudentsBulkAction } from "@/app/actions/students-admin";
import type { StudentAdminListItem } from "@/lib/data/students-admin";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import {
  AlertDialog,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Mail,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function cardInitials(firstName: string, lastName: string) {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  const pair = `${a}${b}`.toUpperCase();
  return pair || "?";
}

type Props = {
  locale: AppLocale;
  students: StudentAdminListItem[];
  /** Réservé au directeur — même périmètre que la suppression d’une classe. */
  canBulkDelete?: boolean;
};

export function AdminStudentsSearchableList({
  locale,
  students,
  canBulkDelete = false,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin");
  const ts = useTranslations("admin.students");
  const [query, setQuery] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return students;
    return students.filter((s) => {
      const hay = [
        s.firstName,
        s.lastName,
        `${s.firstName} ${s.lastName}`,
        s.email ?? "",
        s.className ?? "",
        s.age != null ? String(s.age) : "",
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "");
      return hay.includes(q);
    });
  }, [students, query]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const leaveBulkMode = () => {
    setBulkMode(false);
    setSelected(new Set());
    setConfirmOpen(false);
  };

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map((s) => s.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const mapDeleteErr = (code: string) => {
    if (code === "FORBIDDEN") return ts("bulkDeleteErrorForbidden");
    if (code === "NO_SERVICE_ROLE") return ts("bulkDeleteErrorNoServiceRole");
    if (code === "EMPTY_SELECTION") return ts("bulkDeleteEmptySelection");
    if (code === "NOT_FOUND") return ts("bulkDeleteErrorNotFound");
    return ts("bulkDeleteErrorGeneric");
  };

  const runBulkDelete = () => {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error(ts("bulkDeleteEmptySelection"));
      return;
    }
    startTransition(async () => {
      const res = await deleteStudentsBulkAction(locale, ids);
      if (!res.ok) {
        toast.error(mapDeleteErr(String(res.error)));
        return;
      }
      toast.success(ts("bulkDeleteSuccess", { count: res.deleted }));
      if (res.authRemovalFailed != null && res.authRemovalFailed > 0) {
        toast.warning(
          ts("bulkDeleteAuthPartial", { count: res.authRemovalFailed }),
        );
      }
      setConfirmOpen(false);
      leaveBulkMode();
      router.refresh();
    });
  };

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground">
          <UserRound className="h-7 w-7" aria-hidden />
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("students.emptyList")}
        </p>
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-5">
      {canBulkDelete ? (
        <div className="flex flex-wrap items-center gap-2">
          {!bulkMode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setBulkMode(true);
                setSelected(new Set());
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {ts("bulkDeleteToggle")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={leaveBulkMode}
              >
                {ts("bulkDeleteCancelMode")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={selectAllFiltered}
                disabled={filtered.length === 0}
              >
                {ts("bulkDeleteSelectAllVisible")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={clearSelection}
                disabled={selectedCount === 0}
              >
                {ts("bulkDeleteClearSelection")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-xl"
                disabled={selectedCount === 0 || pending}
                onClick={() => setConfirmOpen(true)}
              >
                {ts("bulkDeleteSubmit", { count: selectedCount })}
              </Button>
              <span className="text-sm text-muted-foreground">
                {ts("bulkDeleteSelectedHint", { count: selectedCount })}
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="relative max-w-xl lg:max-w-lg">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("students.searchPlaceholder")}
          aria-label={t("students.searchAria")}
          className={cn(
            "h-11 bg-background pl-10 shadow-sm",
            query ? "pr-11" : "pr-4",
          )}
          autoComplete="off"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
            aria-label={t("students.searchClearAria")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground dark:bg-muted/10">
          {t("students.searchNoResults")}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const isSel = selected.has(s.id);

            const cardInner = (
              <Card
                className={cn(
                  "h-full overflow-hidden border-border bg-card shadow-sm transition-colors",
                  bulkMode &&
                    "cursor-pointer ring-offset-background transition-colors",
                  bulkMode &&
                    isSel &&
                    "border-primary ring-2 ring-primary/45 ring-offset-2",
                  !bulkMode &&
                    "hover:border-primary/30 hover:bg-muted/[0.35]",
                )}
              >
                <CardHeader className="flex flex-row items-start gap-3 pb-2 pt-4">
                  {bulkMode ? (
                    <span className="flex shrink-0 items-start pt-1">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(s.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-input accent-primary"
                        aria-label={ts("bulkDeleteCheckboxAria", {
                          name: `${s.firstName} ${s.lastName}`,
                        })}
                      />
                    </span>
                  ) : null}
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold uppercase text-muted-foreground ring-1 ring-border"
                    aria-hidden
                  >
                    {cardInitials(s.firstName, s.lastName)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle
                        className={cn(
                          "text-base font-semibold leading-tight",
                          !bulkMode && "group-hover:text-primary",
                        )}
                      >
                        {s.firstName} {s.lastName}
                      </CardTitle>
                      {!bulkMode ? (
                        <ChevronRight
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-70 transition-colors group-hover:text-primary group-hover:opacity-100"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <CardDescription className="space-y-1.5 text-xs leading-relaxed">
                      {s.className ? (
                        <Badge variant="secondary" className="font-normal">
                          {s.className}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("students.classNone")}
                        </span>
                      )}
                      {s.age != null ? (
                        <span className="block text-muted-foreground">
                          {t("students.ageLabel")} · {s.age}
                        </span>
                      ) : null}
                      {s.email ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0 opacity-70" />
                          <span className="truncate">{s.email}</span>
                        </span>
                      ) : null}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="border-t border-border px-6 pb-4 pt-3">
                  {!bulkMode ? (
                    <span className="text-xs text-muted-foreground">
                      {t("students.openStudent")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {isSel ? ts("bulkDeleteCardHintSelected") : ts("bulkDeleteCardHintTap")}
                    </span>
                  )}
                </CardContent>
              </Card>
            );

            if (bulkMode) {
              return (
                <button
                  key={s.id}
                  type="button"
                  className="group block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => toggleSelect(s.id)}
                >
                  {cardInner}
                </button>
              );
            }

            return (
              <Link
                key={s.id}
                href={`/admin/students/${s.id}`}
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {cardInner}
              </Link>
            );
          })}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ts("bulkDeleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {ts("bulkDeleteConfirmDescription", {
                  count: selectedCount,
                })}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {ts("bulkDeleteConfirmCancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => runBulkDelete()}
            >
              {pending ? ts("bulkDeleteConfirmWorking") : ts("bulkDeleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
