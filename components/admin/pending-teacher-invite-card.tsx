"use client";

import { deletePendingTeacherInviteAction } from "@/app/actions/staff-admin";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AdminClassOption } from "@/lib/data/school";
import { formatCloudClassDisplayName } from "@/lib/format-cloud-class-display-name";
import type { PendingTeacherInviteRow } from "@/lib/data/staff-admin";
import type { AppLocale } from "@/i18n/routing";
import type { TeacherEmploymentStatus } from "@/types";
import { useRouter } from "@/i18n/navigation";
import { format, parseISO } from "date-fns";
import { Clock, GraduationCap, Mail, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Props = {
  invite: PendingTeacherInviteRow;
  locale: AppLocale;
  classOptions: AdminClassOption[];
};

function formatInviteDate(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const d = parseISO(value.trim());
    return format(d, "yyyy-MM-dd HH:mm");
  } catch {
    return value;
  }
}

export function PendingTeacherInviteCard({
  invite,
  locale,
  classOptions,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin.accounts");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const roleLabel = (() => {
    switch (invite.role) {
      case "PROF_PRINCIPAL":
        return t("rolePrincipal");
      case "PROFESSEUR":
        return t("roleTeacher");
      default:
        return invite.role;
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
    invite.role === "PROF_PRINCIPAL" && invite.principalClassIds.length > 0
      ? invite.principalClassIds.map((id) => {
          const c = classById.get(id);
          return c
            ? formatCloudClassDisplayName(
                c.name,
                c.academicYearStart,
                c.academicYearEnd,
              )
            : id.slice(0, 8);
        })
      : [];

  const invitedAt = formatInviteDate(invite.createdAt);

  return (
    <Card className="relative border-amber-500/35 bg-amber-500/[0.05] shadow-sm ring-1 ring-amber-500/15 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md dark:bg-amber-500/[0.08] dark:ring-amber-400/20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-amber-500/15 to-transparent"
      />
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-600/45 bg-amber-500/15 text-amber-950 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-50"
          >
            {t("inviteNeverLoggedIn")}
          </Badge>
          <Badge variant="secondary">{roleLabel}</Badge>
          {employmentLabel(invite.teacherEmploymentStatus) ? (
            <Badge variant="outline">{employmentLabel(invite.teacherEmploymentStatus)}</Badge>
          ) : null}
        </div>
        <CardTitle className="text-xl leading-snug">
          {invite.firstName} {invite.lastName}
        </CardTitle>
        <CardDescription className="flex flex-col gap-1 text-sm">
          <span className="inline-flex items-center gap-2 text-foreground">
            <Mail className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="break-all">{invite.email}</span>
          </span>
          <span className="text-muted-foreground">{t("invitePendingHint")}</span>
          {invitedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {t("inviteCreatedAt", { date: invitedAt })}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        {principalNames.length > 0 ? (
          <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-background/60 px-3 py-2 dark:bg-background/40">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium">{t("invitePrincipalClasses")}</p>
              <p className="text-muted-foreground">{principalNames.join(", ")}</p>
            </div>
          </div>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {t("inviteRevokeButton")}
        </Button>
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("inviteRevokeDialogTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span>{t("inviteRevokeDialogBody")}</span>
                <span className="block font-medium text-foreground">
                  {invite.firstName} {invite.lastName} —{" "}
                  <span className="break-all">{invite.email}</span>
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>
                {t("cancelDialog")}
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    const res = await deletePendingTeacherInviteAction(
                      locale,
                      invite.email,
                    );
                    if (res.ok) {
                      toast.success(t("inviteRevokedToast"));
                      setConfirmOpen(false);
                      router.refresh();
                      return;
                    }
                    const detail =
                      res.error === "GENERIC" ? res.detail : undefined;
                    const msg =
                      res.error === "FORBIDDEN"
                        ? t("errorForbidden")
                        : res.error === "NO_SERVICE_ROLE"
                          ? t("errorNoServiceRole")
                          : res.error === "INVALID_EMAIL"
                            ? t("errorInvalidEmail")
                            : res.error === "NOT_FOUND"
                              ? t("inviteRevokeNotFound")
                              : t("errorGeneric");
                    toast.error(msg, detail ? { description: detail } : undefined);
                  });
                }}
              >
                {t("inviteRevokeConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
