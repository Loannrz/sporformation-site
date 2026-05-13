"use client";

import {
  deleteTeacherAndDocumentsAction,
  markTeacherLeftEstablishmentAction,
  reactivateTeacherEstablishmentAction,
  resetTeacherPasswordAction,
  updateTeacherProfileAction,
} from "@/app/actions/staff-admin";
import type { StaffAdminRow } from "@/lib/data/staff-admin";
import type { AdminClassOption } from "@/lib/data/school";
import { PrincipalClassPicker } from "@/components/admin/principal-class-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import type { AppLocale } from "@/i18n/routing";
import type { UserRole } from "@/types";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";

type Props = {
  locale: AppLocale;
  staff: StaffAdminRow;
  viewerId: string;
  viewerRole: UserRole;
  classOptions: AdminClassOption[];
};

export function TeacherAdminPanel({
  locale,
  staff,
  viewerId,
  viewerRole,
  classOptions,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin.accounts");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(staff.firstName);
  const [lastName, setLastName] = useState(staff.lastName);
  const [email, setEmail] = useState(staff.email);
  const [bio, setBio] = useState(staff.bio ?? "");
  const [role, setRole] = useState<UserRole>(staff.role);
  const [subjectsCsv, setSubjectsCsv] = useState(
    (staff.subjects ?? []).join(", "),
  );
  const [principalClassIds, setPrincipalClassIds] = useState<string[]>(
    staff.principalClassIds ?? [],
  );

  const [newPassword, setNewPassword] = useState("");
  const [leftOn, setLeftOn] = useState(
    staff.leftEstablishmentOn ?? new Date().toISOString().slice(0, 10),
  );

  const isSelf = viewerId === staff.id;
  const isDirectorTarget = staff.role === "DIRECTEUR";
  const isAdminViewer = viewerRole === "ADMINISTRATEUR";

  useEffect(() => {
    setFirstName(staff.firstName);
    setLastName(staff.lastName);
    setEmail(staff.email);
    setBio(staff.bio ?? "");
    setRole(staff.role);
    setSubjectsCsv((staff.subjects ?? []).join(", "));
    setPrincipalClassIds(staff.principalClassIds ?? []);
    setLeftOn(
      staff.leftEstablishmentOn ?? new Date().toISOString().slice(0, 10),
    );
  }, [staff]);

  const mapErr = (code: string) => {
    const keys: Record<string, string> = {
      FORBIDDEN: t("errorForbidden"),
      NO_SERVICE_ROLE: t("errorNoServiceRole"),
      NO_SELF: t("errorNoSelf"),
      NO_DELETE_DIRECTOR: t("errorNoDeleteDirector"),
      CANT_PROMOTE_DIRECTOR: t("errorCantPromoteDirector"),
      DEMOTE_SELF: t("errorDemoteSelf"),
      INVALID_ROLE: t("errorInvalidRole"),
      PRINCIPAL_CLASSES_REQUIRED: t("errorPrincipalClassesRequired"),
      INVALID_PRINCIPAL_CLASSES: t("errorInvalidPrincipalClasses"),
    };
    return keys[code] ?? code;
  };

  const saveProfile = () => {
    setError(null);
    setMessage(null);
    if (role === "PROF_PRINCIPAL" && principalClassIds.length === 0) {
      setError(t("errorPrincipalClassesRequired"));
      toast.error(t("errorPrincipalClassesRequired"));
      return;
    }
    startTransition(async () => {
      const res = await updateTeacherProfileAction(locale, staff.id, {
        firstName,
        lastName,
        email,
        bio,
        role,
        subjectsCsv,
        principalClassIds:
          role === "PROF_PRINCIPAL" ? principalClassIds : undefined,
      });
      if (!res.ok) {
        setError(mapErr(String(res.error)));
        toast.error(mapErr(String(res.error)));
        return;
      }
      setMessage(t("saved"));
      toast.success(t("saved"));
      router.refresh();
    });
  };

  const resetPassword = () => {
    setError(null);
    setMessage(null);
    if (newPassword.length < 8) {
      setError(t("passwordTooShort"));
      toast.error(t("passwordTooShort"));
      return;
    }
    startTransition(async () => {
      const res = await resetTeacherPasswordAction(
        locale,
        staff.id,
        newPassword,
      );
      if (!res.ok) {
        setError(mapErr(String(res.error)));
        toast.error(mapErr(String(res.error)));
        return;
      }
      setMessage(t("passwordResetDone"));
      toast.success(t("passwordResetDone"));
      setNewPassword("");
      router.refresh();
    });
  };

  const markLeft = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await markTeacherLeftEstablishmentAction(
        locale,
        staff.id,
        leftOn,
      );
      if (!res.ok) {
        setError(mapErr(String(res.error)));
        toast.error(mapErr(String(res.error)));
        return;
      }
      setMessage(t("markedLeftDone"));
      toast.success(t("markedLeftDone"));
      router.refresh();
    });
  };

  const reactivate = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await reactivateTeacherEstablishmentAction(locale, staff.id);
      if (!res.ok) {
        setError(mapErr(String(res.error)));
        toast.error(mapErr(String(res.error)));
        return;
      }
      setMessage(t("reactivatedDone"));
      toast.success(t("reactivatedDone"));
      router.refresh();
    });
  };

  const deleteForever = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await deleteTeacherAndDocumentsAction(locale, staff.id);
      if (!res.ok) {
        setError(mapErr(String(res.error)));
        toast.error(mapErr(String(res.error)));
        return;
      }
      toast.success(t("deleteDoneToast"));
      router.push(`/administration/comptes`);
    });
  };

  return (
    <div className="space-y-8">
      {!staff.activeAtEstablishment ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <Badge
            variant="outline"
            className="border-amber-600 text-amber-900 dark:text-amber-100"
          >
            {t("badgeLeft")}
          </Badge>
          <span>
            {t("leftOnLabel")}: {staff.leftEstablishmentOn ?? "—"}
          </span>
          {!isAdminViewer ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={reactivate}
              disabled={pending}
            >
              {t("reactivate")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
        <h2 className="text-lg font-semibold">{t("editProfile")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ed-first">{t("firstName")}</Label>
            <Input
              id="ed-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ed-last">{t("lastName")}</Label>
            <Input
              id="ed-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ed-email">{t("email")}</Label>
            <Input
              id="ed-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ed-bio">{t("bio")}</Label>
            <Textarea
              id="ed-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ed-role">{t("role")}</Label>
            {isAdminViewer ? (
              <select
                id="ed-role"
                value={role}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  setRole(r);
                  if (r !== "PROF_PRINCIPAL") setPrincipalClassIds([]);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="PROFESSEUR">{t("roleTeacher")}</option>
                <option value="PROF_PRINCIPAL">{t("rolePrincipal")}</option>
              </select>
            ) : (
              <select
                id="ed-role"
                value={role}
                disabled={isDirectorTarget && !isSelf}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  setRole(r);
                  if (r !== "PROF_PRINCIPAL") setPrincipalClassIds([]);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <option value="ADMINISTRATEUR">{t("roleAdministrator")}</option>
                <option value="PROF_PRINCIPAL">{t("rolePrincipal")}</option>
                <option value="PROFESSEUR">{t("roleTeacher")}</option>
                {isSelf ? (
                  <option value="DIRECTEUR">{t("roleDirector")}</option>
                ) : null}
              </select>
            )}
            {isDirectorTarget && !isSelf ? (
              <p className="text-xs text-muted-foreground">
                {t("directorRoleLocked")}
              </p>
            ) : null}
          </div>
          {role === "PROF_PRINCIPAL" ? (
            <PrincipalClassPicker
              id="ed-principal-classes"
              label={`${t("principalClassesLabel")} *`}
              help={t("principalClassesHelp")}
              emptyHint={t("principalClassesEmpty")}
              classOptions={classOptions}
              value={principalClassIds}
              onChange={setPrincipalClassIds}
            />
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ed-subj">{t("subjectsHint")}</Label>
            <Input
              id="ed-subj"
              value={subjectsCsv}
              onChange={(e) => setSubjectsCsv(e.target.value)}
              placeholder={t("subjectsPlaceholder")}
            />
          </div>
        </div>
        <Button type="button" onClick={saveProfile} disabled={pending}>
          {pending ? t("saving") : t("saveProfile")}
        </Button>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
        <h2 className="text-lg font-semibold">{t("resetPasswordTitle")}</h2>
        <div className="space-y-2 sm:max-w-md">
          <Label htmlFor="ed-pw">{t("newPassword")}</Label>
          <Input
            id="ed-pw"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={resetPassword}
          disabled={pending}
        >
          {t("applyPassword")}
        </Button>
      </section>

      {staff.activeAtEstablishment &&
      !isSelf &&
      !isDirectorTarget &&
      !isAdminViewer ? (
        <section className="space-y-4 rounded-xl border border-border bg-card/50 p-4">
          <h2 className="text-lg font-semibold">
            {t("leaveEstablishmentTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("leaveEstablishmentHint")}
          </p>
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="ed-left">{t("leftOnField")}</Label>
            <Input
              id="ed-left"
              type="date"
              value={leftOn}
              onChange={(e) => setLeftOn(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={markLeft}
            disabled={pending}
          >
            {t("markLeftSubmit")}
          </Button>
        </section>
      ) : null}

      {!isSelf && !isDirectorTarget && !isAdminViewer ? (
        <section className="space-y-4 rounded-xl border border-destructive/50 bg-destructive/5 p-4">
          <h2 className="text-lg font-semibold text-destructive">
            {t("dangerZone")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("deleteWarnLead")}</p>
          <ul className="list-inside list-disc text-sm text-destructive/90">
            <li>{t("deleteWarnDocs")}</li>
            <li>{t("deleteWarnStorage")}</li>
          </ul>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={pending}>
                {t("deleteForever")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("deleteDialogTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("deleteDialogBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancelDialog")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteForever()}
                >
                  {t("deleteConfirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      ) : null}

      {message ? (
        <p
          className="text-sm text-emerald-600 dark:text-emerald-400"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
