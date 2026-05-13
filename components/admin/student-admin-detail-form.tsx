"use client";

import { updateStudentAction } from "@/app/actions/students-admin";
import type { StudentAdminDetail } from "@/lib/data/students-admin";
import { adminClassOptionLabel } from "@/lib/academic-year-display";
import type { AdminClassOption } from "@/lib/data/school";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useEffect, useState, useTransition, type FormEvent } from "react";

type Props = {
  locale: AppLocale;
  initial: StudentAdminDetail;
  classOptions: AdminClassOption[];
  onSaved?: () => void;
};

export function StudentAdminDetailForm({
  locale,
  initial,
  classOptions,
  onSaved,
}: Props) {
  const router = useRouter();
  const t = useTranslations("admin.students");
  const tc = useTranslations("admin.classManage");
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email ?? "");
  const [classId, setClassId] = useState<string>(initial.classId ?? "");
  const [entryDate, setEntryDate] = useState(
    initial.entryDate?.slice(0, 10) ?? "",
  );
  const [birthDate, setBirthDate] = useState(
    initial.birthDate?.slice(0, 10) ?? "",
  );
  const [sex, setSex] = useState<string>(initial.sex ?? "");
  const [birthPlace, setBirthPlace] = useState(initial.birthPlace ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(initial.firstName);
    setLastName(initial.lastName);
    setEmail(initial.email ?? "");
    setClassId(initial.classId ?? "");
    setEntryDate(initial.entryDate?.slice(0, 10) ?? "");
    setBirthDate(initial.birthDate?.slice(0, 10) ?? "");
    setSex(initial.sex ?? "");
    setBirthPlace(initial.birthPlace ?? "");
  }, [initial]);

  const mapErr = (code: string) => {
    if (code === "FORBIDDEN") return tc("errorForbidden");
    if (code === "NO_SERVICE_ROLE") return tc("errorNoServiceRole");
    if (code === "NAME_REQUIRED") return t("errorNameRequired");
    return code;
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    startTransition(async () => {
      const res = await updateStudentAction(locale, initial.id, {
        firstName,
        lastName,
        email: email.trim() || null,
        classId: classId || null,
        entryDate: entryDate || null,
        birthDate: birthDate || null,
        sex: sex || null,
        birthPlace: birthPlace.trim() || null,
      });
      if (!res.ok) {
        const msg = mapErr(String(res.error));
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(t("savedToast"));
      onSaved?.();
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSave} className="space-y-6">
      <div className="grid gap-4 sm:max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="st-fn">{t("firstNameLabel")} *</Label>
            <Input
              id="st-fn"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-ln">{t("lastNameLabel")} *</Label>
            <Input
              id="st-ln"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="st-em">{t("emailLabel")}</Label>
          <Input
            id="st-em"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="st-cl">{t("classLabel")}</Label>
          <select
            id="st-cl"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("classNone")}</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {adminClassOptionLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="st-bd">{t("birthDateLabel")}</Label>
            <Input
              id="st-bd"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="st-sx">{t("sexLabel")}</Label>
            <select
              id="st-sx"
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t("sexUnset")}</option>
              <option value="M">{t("sexM")}</option>
              <option value="F">{t("sexF")}</option>
              <option value="X">{t("sexX")}</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="st-bp">{t("birthPlaceLabel")}</Label>
          <Input
            id="st-bp"
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="st-ed">{t("entryDateLabel")}</Label>
          <Input
            id="st-ed"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
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
  );
}
