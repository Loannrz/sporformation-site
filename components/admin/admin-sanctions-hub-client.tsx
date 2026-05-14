"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Download } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { AdminActiveSanctionRow } from "@/lib/data/sanctions-admin";
import { SANCTION_FORM_TYPES_ORDER } from "@/lib/discipline-types";
import type { SanctionType, SessionUser, UserRole } from "@/types";
import { sanctionTypeLabel } from "@/lib/sanction-labels";
import {
  markAdminSanctionsSeenAction,
  updateSanctionStaffAdminAction,
  retireSanctionStaffAdminAction,
  deleteSanctionDirectorAction,
} from "@/app/actions/sanctions-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { canDownloadSanctionPdf } from "@/lib/permissions";

type Props = {
  locale: AppLocale;
  rows: AdminActiveSanctionRow[];
  lastSeenIso: string | null;
  weekCreatedCount: number;
  isDirector: boolean;
  hubMode: "manage" | "readonly";
  viewerRole: UserRole;
  viewer: SessionUser;
};

function parseSeenMs(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function AdminSanctionsHubClient({
  locale,
  rows,
  lastSeenIso,
  weekCreatedCount,
  isDirector,
  hubMode,
  viewerRole,
  viewer,
}: Props) {
  const t = useTranslations("admin.sanctionsHub");
  const dLocale = locale === "fr" ? fr : enUS;
  const dl: "fr" | "en" = locale === "en" ? "en" : "fr";

  const seenMs = useMemo(() => parseSeenMs(lastSeenIso), [lastSeenIso]);

  useEffect(() => {
    if (hubMode !== "manage") return undefined;
    return () => {
      void markAdminSanctionsSeenAction(locale);
    };
  }, [hubMode, locale]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminActiveSanctionRow | null>(null);
  const [pending, startTransition] = useTransition();

  const openEdit = (row: AdminActiveSanctionRow) => {
    setEditing(row);
    setEditOpen(true);
  };

  const runRetire = (row: AdminActiveSanctionRow) => {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("sanctionId", row.id);
    fd.set("studentId", row.studentId);
    startTransition(async () => {
      const res = await retireSanctionStaffAdminAction(fd);
      if (!res.ok) toast.error(t("toastRetireFailed"));
      else toast.success(t("toastRetired"));
    });
  };

  const runDelete = (row: AdminActiveSanctionRow) => {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("sanctionId", row.id);
    fd.set("studentId", row.studentId);
    startTransition(async () => {
      const res = await deleteSanctionDirectorAction(fd);
      if (!res.ok) toast.error(t("toastDeleteFailed"));
      else toast.success(t("toastDeleted"));
    });
  };

  return (
    <>
      {weekCreatedCount > 0 ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50">
          {t("weekBanner", { count: weekCreatedCount })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="divide-y divide-border">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            rows.map((row) => {
              const createdMs = new Date(row.createdAt).getTime();
              const isNew =
                hubMode === "manage" &&
                Number.isFinite(createdMs) &&
                createdMs > seenMs + 500;
              return (
                <div
                  key={row.id}
                  className={cn(
                    "flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-start sm:justify-between",
                    isNew
                      ? "bg-amber-500/[0.12] dark:bg-amber-500/15"
                      : "bg-transparent",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isNew ? (
                        <Badge className="bg-amber-600 text-white hover:bg-amber-600">
                          {t("badgeNew")}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary" className="capitalize">
                        {sanctionTypeLabel(row.type, dl)}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(row.occurredAt), "PPp", {
                          locale: dLocale,
                        })}
                      </span>
                    </div>
                    <p className="font-medium leading-snug">
                      {viewerRole === "ELEVE" ? (
                        <span>
                          {row.studentFirstName} {row.studentLastName}
                        </span>
                      ) : (
                        <Link
                          href={`/etudiants/${row.studentId}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {row.studentFirstName} {row.studentLastName}
                        </Link>
                      )}
                      {row.className ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.className}
                        </span>
                      ) : null}
                    </p>
                    {row.title ? (
                      <p className="text-sm font-semibold">{row.title}</p>
                    ) : null}
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                  {hubMode === "manage" ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => openEdit(row)}
                      >
                        {t("edit")}
                      </Button>
                      {canDownloadSanctionPdf(
                        viewer,
                        row.classId ?? "",
                      ) ? (
                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                        >
                          <a
                            href={`/api/pdf/sanction?id=${encodeURIComponent(row.id)}&locale=${locale}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download className="h-4 w-4" aria-hidden />
                            {t("downloadPdf")}
                          </a>
                        </Button>
                      ) : null}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="rounded-lg"
                            disabled={pending}
                          >
                            {t("retire")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("retireTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("retireDesc")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                            <Button
                              type="button"
                              variant="default"
                              disabled={pending}
                              onClick={() => runRetire(row)}
                            >
                              {t("retireConfirm")}
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {isDirector ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="rounded-lg"
                              disabled={pending}
                            >
                              {t("delete")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("deleteDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={pending}
                                onClick={() => runDelete(row)}
                              >
                                {t("deleteConfirm")}
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[min(90vh,680px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.append("locale", locale);
                fd.append("sanctionId", editing.id);
                fd.append("studentId", editing.studentId);
                startTransition(async () => {
                  const res = await updateSanctionStaffAdminAction(fd);
                  if (!res.ok) toast.error(t("toastUpdateFailed"));
                  else {
                    toast.success(t("toastUpdated"));
                    setEditOpen(false);
                    setEditing(null);
                  }
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="san-title">{t("fieldTitle")}</Label>
                <Input
                  id="san-title"
                  name="title"
                  defaultValue={editing.title ?? ""}
                  placeholder={t("fieldTitlePlaceholder")}
                  maxLength={240}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="san-type">{t("fieldKind")}</Label>
                <select
                  id="san-type"
                  name="type"
                  required
                  disabled={pending}
                  defaultValue={editing.type}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                >
                  {SANCTION_FORM_TYPES_ORDER.map((ty: SanctionType) => (
                    <option key={ty} value={ty}>
                      {sanctionTypeLabel(ty, dl)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="san-desc">{t("fieldDescription")}</Label>
                <Textarea
                  id="san-desc"
                  name="description"
                  required
                  minLength={4}
                  disabled={pending}
                  defaultValue={editing.description}
                  className="min-h-[140px]"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={pending}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={pending}>
                  {t("save")}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
