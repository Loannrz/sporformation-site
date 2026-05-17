"use client";

import { createTeacherAction } from "@/app/actions/staff-admin";
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
import type { UserRole } from "@/types";
import { useRouter } from "@/i18n/navigation";
import type { AdminClassOption } from "@/lib/data/school";
import { PrincipalClassPicker } from "@/components/admin/principal-class-picker";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState, useTransition, useEffect, type FormEvent } from "react";

type Props = {
  locale: AppLocale;
  viewerRole: UserRole;
  /** Liste des classes (titulaires) ; tableau vide si indisponible. */
  classOptions?: AdminClassOption[];
};

export function CreateTeacherModal({
  locale,
  viewerRole,
  classOptions = [],
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin.accounts");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserRole>("PROFESSEUR");
  const [bio, setBio] = useState("");
  const [subjectsCsv, setSubjectsCsv] = useState("");
  const [principalClassIds, setPrincipalClassIds] = useState<string[]>([]);
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);
  const [directorElevatedPrivilegesConfirmed, setDirectorElevatedPrivilegesConfirmed] =
    useState(false);

  const reset = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("PROFESSEUR");
    setBio("");
    setSubjectsCsv("");
    setPrincipalClassIds([]);
    setAssignedClassIds([]);
    setDirectorElevatedPrivilegesConfirmed(false);
    setError(null);
  };

  useEffect(() => {
    if (viewerRole === "ADMINISTRATEUR") {
      setRole("PROFESSEUR");
    }
  }, [viewerRole, open]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (role === "PROF_PRINCIPAL" && principalClassIds.length === 0) {
      setError(t("errorPrincipalClassesRequired"));
      return;
    }
    if (role === "DIRECTEUR" && !directorElevatedPrivilegesConfirmed) {
      setError(t("errorDirectorConfirmationRequired"));
      return;
    }
    startTransition(async () => {
      let raw: Awaited<ReturnType<typeof createTeacherAction>>;
      try {
        raw = await createTeacherAction(locale, {
          email,
          firstName,
          lastName,
          role,
          employmentStatus: "NEW_TO_SCHOOL",
          joinedAt: null,
          leftEstablishmentOn: null,
          bio: bio.trim() || undefined,
          subjectsCsv: subjectsCsv.trim() || undefined,
          principalClassIds:
            role === "PROF_PRINCIPAL" ? principalClassIds : undefined,
          assignedClassIds:
            role === "PROFESSEUR" || role === "PROF_PRINCIPAL"
              ? assignedClassIds
              : undefined,
          directorElevatedPrivilegesConfirmed:
            role === "DIRECTEUR"
              ? directorElevatedPrivilegesConfirmed
              : undefined,
        });
      } catch {
        setError(t("errorGeneric"));
        return;
      }

      if (!raw || typeof raw !== "object" || !("ok" in raw)) {
        setError(t("errorGeneric"));
        return;
      }

      if (!raw.ok) {
        const err = raw.error;
        setError(
          err === "NO_SERVICE_ROLE"
            ? t("errorNoServiceRole")
            : err === "INVALID_ROLE"
              ? t("errorInvalidRole")
              : err === "MISSING_REQUIRED_FIELDS"
                ? t("errorMissingRequired")
                : err === "INVALID_EMAIL"
                  ? t("errorInvalidEmail")
                  : err === "PASSWORD_TOO_SHORT"
                    ? t("passwordTooShort")
                    : err === "EMAIL_ALREADY_IN_APP"
                      ? t("errorEmailAlreadyInApp")
                      : err === "EMAIL_AUTH_EXISTS"
                        ? t("errorEmailAuthExists")
                        : err === "AUTH_USER_LOOKUP_FAILED"
                          ? t("errorAuthUserLookup")
                          : err === "PRINCIPAL_CLASSES_REQUIRED"
                            ? t("errorPrincipalClassesRequired")
                            : err === "INVALID_PRINCIPAL_CLASSES"
                              ? t("errorInvalidPrincipalClasses")
                              : err === "INVALID_ASSIGNED_CLASSES"
                                ? t("errorInvalidAssignedClasses")
                                : err === "DIRECTOR_CONFIRMATION_REQUIRED"
                                  ? t("errorDirectorConfirmationRequired")
                                  : typeof err === "string"
                                    ? err
                                    : t("errorGeneric"),
        );
        return;
      }

      if ("pendingSignup" in raw && raw.pendingSignup) {
        toast.success(t("createdPendingSignupToast"));
        setOpen(false);
        reset();
        router.refresh();
        return;
      }

      const createdId =
        "id" in raw && typeof raw.id === "string" ? raw.id : null;
      if (!createdId) {
        setError(t("errorGeneric"));
        return;
      }

      toast.success(
        "linkedExistingAuth" in raw && raw.linkedExistingAuth
          ? t("createdLinkedExistingAuthToast")
          : t("createdToast"),
      );
      setOpen(false);
      reset();
      router.push(`/administration/comptes/${createdId}`);
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
        <Button type="button" className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" aria-hidden />
          {t("createOpenButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createModalHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ct-first">{t("firstName")} *</Label>
              <Input
                id="ct-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct-last">{t("lastName")} *</Label>
              <Input
                id="ct-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ct-email">{t("email")} *</Label>
              <Input
                id="ct-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ct-role">{t("role")} *</Label>
              <select
                id="ct-role"
                value={role}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  setRole(r);
                  if (r !== "PROF_PRINCIPAL") setPrincipalClassIds([]);
                  if (r !== "DIRECTEUR") setDirectorElevatedPrivilegesConfirmed(false);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="PROFESSEUR">{t("roleTeacher")}</option>
                <option value="PROF_PRINCIPAL">{t("rolePrincipal")}</option>
                {viewerRole === "DIRECTEUR" ? (
                  <option value="DIRECTEUR">{t("roleDirector")}</option>
                ) : null}
              </select>
            </div>
            {viewerRole === "DIRECTEUR" && role === "DIRECTEUR" ? (
              <div className="sm:col-span-2 space-y-2 rounded-lg border border-amber-500/35 bg-amber-500/[0.06] p-4 dark:bg-amber-500/10">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
                  <input
                    id="ct-director-confirm"
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    checked={directorElevatedPrivilegesConfirmed}
                    onChange={(e) =>
                      setDirectorElevatedPrivilegesConfirmed(e.target.checked)
                    }
                  />
                  <span className="font-medium text-foreground">
                    {t("directorCreateConfirmLabel")}
                  </span>
                </label>
              </div>
            ) : null}
            {role === "PROF_PRINCIPAL" ? (
              <PrincipalClassPicker
                id="ct-principal-classes"
                label={`${t("principalClassesLabel")} *`}
                help={t("principalClassesHelp")}
                emptyHint={t("principalClassesEmpty")}
                classOptions={classOptions}
                value={principalClassIds}
                onChange={(ids) => {
                  setPrincipalClassIds(ids);
                  setAssignedClassIds((prev) =>
                    prev.filter((x) => !ids.includes(x)),
                  );
                }}
              />
            ) : null}
            {role === "PROFESSEUR" || role === "PROF_PRINCIPAL" ? (
              <PrincipalClassPicker
                id="ct-assigned-classes"
                label={t("assignedClassesLabel")}
                help={t("assignedClassesHelp")}
                emptyHint={t("assignedClassesEmpty")}
                classOptions={
                  role === "PROF_PRINCIPAL"
                    ? classOptions.filter(
                        (c) => !principalClassIds.includes(c.id),
                      )
                    : classOptions
                }
                value={assignedClassIds}
                onChange={setAssignedClassIds}
              />
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ct-bio">{t("bioOptional")}</Label>
              <Textarea
                id="ct-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ct-subj">{t("subjectsOptional")}</Label>
              <Input
                id="ct-subj"
                value={subjectsCsv}
                onChange={(e) => setSubjectsCsv(e.target.value)}
                placeholder={t("subjectsPlaceholder")}
              />
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t("cancelDialog")}
            </Button>
            <Button
              type="submit"
              disabled={
                pending ||
                (role === "DIRECTEUR" && !directorElevatedPrivilegesConfirmed)
              }
            >
              {pending ? t("creating") : t("createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
