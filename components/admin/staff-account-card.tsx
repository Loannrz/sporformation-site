"use client";

import { deleteTeacherAndDocumentsAction } from "@/app/actions/staff-admin";
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
import { Link, useRouter } from "@/i18n/navigation";
import type { AdminClassOption } from "@/lib/data/school";
import { formatCloudClassDisplayName } from "@/lib/format-cloud-class-display-name";
import type { StaffAdminRow } from "@/lib/data/staff-admin";
import type { AppLocale } from "@/i18n/routing";
import type { TeacherEmploymentStatus, UserRole } from "@/types";
import { format, parseISO } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  Mail,
  Trash2,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  staff: StaffAdminRow;
  locale: AppLocale;
  viewerId: string;
  viewerRole: UserRole;
  classOptions: AdminClassOption[];
};

function formatJoinedDate(value: string | null, locale: AppLocale): string | null {
  if (!value?.trim()) return null;
  try {
    const raw = value.trim();
    const d = parseISO(raw.length <= 10 ? `${raw}T12:00:00` : raw);
    return format(d, "PP", { locale: locale === "fr" ? fr : enUS });
  } catch {
    return value;
  }
}

export function StaffAccountCard({
  staff,
  locale,
  viewerId,
  viewerRole,
  classOptions,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin.accounts");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isSelf = viewerId === staff.id;
  const isDirectorTarget = staff.role === "DIRECTEUR";
  const canDelete =
    viewerRole === "DIRECTEUR" && !isSelf && !isDirectorTarget;

  const roleLabel = (() => {
    switch (staff.role) {
      case "DIRECTEUR":
        return t("roleDirector");
      case "ADMINISTRATEUR":
        return t("roleAdministrator");
      case "PROF_PRINCIPAL":
        return t("rolePrincipal");
      case "PROFESSEUR":
        return t("roleTeacher");
      default:
        return staff.role;
    }
  })();

  const employmentLabel = (status: TeacherEmploymentStatus | null) => {
    if (!status) return null;
    switch (status) {
      case "NEW_TO_SCHOOL":
        return t("employmentNew");
      case "ACTIVE_AT_SCHOOL":
        return t("employmentActive");
      case "FORMER_INACTIVE":
        return t("employmentFormer");
      default:
        return null;
    }
  };

  const classById = new Map(classOptions.map((c) => [c.id, c]));
  const principalNames =
    staff.role === "PROF_PRINCIPAL" && staff.principalClassIds?.length
      ? staff.principalClassIds
          .map((id) => {
            const c = classById.get(id);
            return c
              ? formatCloudClassDisplayName(
                  c.name,
                  c.academicYearStart,
                  c.academicYearEnd,
                )
              : id.slice(0, 8);
          })
          .filter(Boolean)
      : [];

  const subjectsLine = (staff.subjects ?? []).filter(Boolean).join(", ");
  const subjectsShort =
    subjectsLine.length > 90 ? `${subjectsLine.slice(0, 87)}…` : subjectsLine;

  const joinedFmt = formatJoinedDate(staff.joinedAt, locale);
  const initials = `${staff.firstName?.[0] ?? ""}${staff.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  const emp = employmentLabel(staff.teacherEmploymentStatus);

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteTeacherAndDocumentsAction(locale, staff.id);
      if (!res.ok) {
        const msg =
          res.error === "FORBIDDEN"
            ? t("errorForbidden")
            : res.error === "NO_SELF"
              ? t("errorNoSelf")
              : res.error === "NO_DELETE_DIRECTOR"
                ? t("errorNoDeleteDirector")
                : res.error === "NO_SERVICE_ROLE"
                  ? t("errorNoServiceRole")
                  : String(res.error);
        toast.error(msg);
        return;
      }
      toast.success(t("deleteDoneToast"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="group relative h-full min-h-0">
      <Link
        href={`/administration/comptes/${staff.id}`}
        className="flex h-full min-h-0 flex-col rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={t("listCardOpenAria", {
          firstName: staff.firstName,
          lastName: staff.lastName,
        })}
      >
        <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-border/90 bg-card shadow-sm transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-md">
          <div
            className="h-1 shrink-0 bg-gradient-to-r from-primary/85 to-accent/75"
            aria-hidden
          />
          <CardHeader className="shrink-0 space-y-4 pb-2">
            <div className="flex gap-3">
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold text-primary"
                aria-hidden
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-lg font-semibold leading-snug">
                  {staff.firstName} {staff.lastName}
                </CardTitle>
                <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{staff.email || "—"}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">
                {roleLabel}
              </Badge>
              {emp ? (
                <Badge variant="outline" className="font-normal">
                  {emp}
                </Badge>
              ) : null}
              {staff.mustSetPassword ? (
                <Badge variant="secondary" className="font-normal">
                  {t("badgePendingPassword")}
                </Badge>
              ) : null}
              {!staff.activeAtEstablishment ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 font-normal text-amber-900 dark:text-amber-100"
                >
                  {t("badgeLeft")}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2.5 pb-14 pt-0 text-sm text-muted-foreground">
            {joinedFmt ? (
              <p className="flex items-start gap-2">
                <Calendar className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
                <span>
                  <span className="font-medium text-foreground/80">
                    {t("listCardJoinedLabel")}
                  </span>{" "}
                  {joinedFmt}
                </span>
              </p>
            ) : null}
            {principalNames.length ? (
              <p className="flex items-start gap-2">
                <GraduationCap
                  className="mt-0.5 size-4 shrink-0 text-primary/70"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-foreground/80">
                    {t("listCardPrincipalLabel")}
                  </span>{" "}
                  {principalNames.join(" · ")}
                </span>
              </p>
            ) : null}
            {subjectsShort ? (
              <p className="flex items-start gap-2">
                <BookOpen
                  className="mt-0.5 size-4 shrink-0 text-primary/70"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-foreground/80">
                    {t("listCardSubjectsLabel")}
                  </span>{" "}
                  <span className="line-clamp-2">{subjectsShort}</span>
                </span>
              </p>
            ) : null}
            {staff.bio?.trim() ? (
              <p className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
                <span className="line-clamp-2 text-xs leading-relaxed">
                  {staff.bio.trim()}
                </span>
              </p>
            ) : null}
            <p className="mt-auto pt-1 text-xs text-primary/80 opacity-0 transition-opacity group-hover:opacity-100">
              {t("listCardOpenHint")}
            </p>
          </CardContent>
        </Card>
      </Link>

      {canDelete ? (
        <>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteDialogTitle")}</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">
                        {staff.firstName} {staff.lastName}
                      </strong>{" "}
                      ({staff.email})
                    </p>
                    <p>{t("deleteWarnLead")}</p>
                    <ul className="list-inside list-disc space-y-1 text-destructive/90">
                      <li>{t("deleteWarnDocs")}</li>
                      <li>{t("deleteWarnStorage")}</li>
                    </ul>
                    <p>{t("deleteDialogBody")}</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>
                  {t("cancelDialog")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={pending}
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                >
                  {t("deleteConfirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="absolute bottom-3 right-3 z-10">
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="size-9 shadow-md"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(true);
              }}
              aria-label={t("deleteCardAria")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
