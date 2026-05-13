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
import type { TeacherEmploymentStatus, UserRole } from "@/types";
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
  classOptions: AdminClassOption[];
};

export function CreateTeacherModal({
  locale,
  viewerRole,
  classOptions,
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
  const [employment, setEmployment] =
    useState<TeacherEmploymentStatus>("NEW_TO_SCHOOL");
  const [joinedAt, setJoinedAt] = useState("");
  const [leftOn, setLeftOn] = useState("");
  const [bio, setBio] = useState("");
  const [subjectsCsv, setSubjectsCsv] = useState("");
  const [principalClassIds, setPrincipalClassIds] = useState<string[]>([]);

  const reset = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setRole("PROFESSEUR");
    setEmployment("NEW_TO_SCHOOL");
    setJoinedAt("");
    setLeftOn("");
    setBio("");
    setSubjectsCsv("");
    setPrincipalClassIds([]);
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
    startTransition(async () => {
      const res = await createTeacherAction(locale, {
        email,
        firstName,
        lastName,
        role,
        employmentStatus: employment,
        joinedAt: joinedAt.trim() || null,
        leftEstablishmentOn:
          employment === "FORMER_INACTIVE" ? leftOn.trim() || null : null,
        bio: bio.trim() || undefined,
        subjectsCsv: subjectsCsv.trim() || undefined,
        principalClassIds:
          role === "PROF_PRINCIPAL" ? principalClassIds : undefined,
      });
      if (!res.ok) {
        setError(
          res.error === "NO_SERVICE_ROLE"
            ? t("errorNoServiceRole")
            : res.error === "INVALID_ROLE"
              ? t("errorInvalidRole")
              : res.error === "LEFT_DATE_REQUIRED"
                ? t("errorLeftDateRequired")
                : res.error === "MISSING_REQUIRED_FIELDS"
                  ? t("errorMissingRequired")
                  : res.error === "INVALID_EMAIL"
                    ? t("errorInvalidEmail")
                    : res.error === "EMAIL_ALREADY_IN_APP"
                      ? t("errorEmailAlreadyInApp")
                      : res.error === "AUTH_USER_LOOKUP_FAILED"
                        ? t("errorAuthUserLookup")
                        : res.error === "PRINCIPAL_CLASSES_REQUIRED"
                          ? t("errorPrincipalClassesRequired")
                          : res.error === "INVALID_PRINCIPAL_CLASSES"
                            ? t("errorInvalidPrincipalClasses")
                            : typeof res.error === "string"
                          ? res.error
                          : t("errorGeneric"),
        );
        return;
      }
      toast.success(
        "linkedExistingAuth" in res && res.linkedExistingAuth
          ? t("createdLinkedExistingAuthToast")
          : t("createdToast"),
      );
      setOpen(false);
      reset();
      router.push(`/administration/comptes/${res.id}`);
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
              {viewerRole === "ADMINISTRATEUR" ? (
                <select
                  id="ct-role"
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
                  id="ct-role"
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
                  <option value="ADMINISTRATEUR">
                    {t("roleAdministrator")}
                  </option>
                </select>
              )}
            </div>
            {role === "PROF_PRINCIPAL" ? (
              <PrincipalClassPicker
                id="ct-principal-classes"
                label={`${t("principalClassesLabel")} *`}
                help={t("principalClassesHelp")}
                emptyHint={t("principalClassesEmpty")}
                classOptions={classOptions}
                value={principalClassIds}
                onChange={setPrincipalClassIds}
              />
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ct-emp">{t("employmentStatus")} *</Label>
              <select
                id="ct-emp"
                value={employment}
                onChange={(e) =>
                  setEmployment(e.target.value as TeacherEmploymentStatus)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="NEW_TO_SCHOOL">{t("employmentNew")}</option>
                <option value="ACTIVE_AT_SCHOOL">{t("employmentActive")}</option>
                <option value="FORMER_INACTIVE">{t("employmentFormer")}</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {t("employmentHelp")}
              </p>
            </div>
            {employment === "FORMER_INACTIVE" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ct-left">{t("leftOnField")} *</Label>
                <Input
                  id="ct-left"
                  type="date"
                  value={leftOn}
                  onChange={(e) => setLeftOn(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ct-joined">{t("joinedAtOptional")}</Label>
                <Input
                  id="ct-joined"
                  type="date"
                  value={joinedAt}
                  onChange={(e) => setJoinedAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("joinedAtHelp")}
                </p>
              </div>
            )}
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
            <Button type="submit" disabled={pending}>
              {pending ? t("creating") : t("createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
