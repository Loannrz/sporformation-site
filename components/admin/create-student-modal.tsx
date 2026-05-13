"use client";

import { createStudentAction } from "@/app/actions/students-admin";
import { adminClassOptionLabel } from "@/lib/academic-year-display";
import type { AdminClassOption } from "@/lib/data/school";
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
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState, useTransition, type FormEvent } from "react";

type Props = { locale: AppLocale; classOptions: AdminClassOption[] };

export function CreateStudentModal({ locale, classOptions }: Props) {
  const router = useRouter();
  const t = useTranslations("admin.students");
  const tc = useTranslations("admin.classManage");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [entryDate, setEntryDate] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<string>("");
  const [birthPlace, setBirthPlace] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setClassId("");
    setEntryDate("");
    setBirthDate("");
    setSex("");
    setBirthPlace("");
    setError(null);
  };

  const mapErr = (code: string) => {
    if (code === "FORBIDDEN") return tc("errorForbidden");
    if (code === "NO_SERVICE_ROLE") return tc("errorNoServiceRole");
    if (code === "NAME_REQUIRED") return t("errorNameRequired");
    return code;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("errorNameRequired"));
      return;
    }
    startTransition(async () => {
      const res = await createStudentAction(locale, {
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
        setError(
          typeof res.error === "string"
            ? mapErr(res.error)
            : t("errorGeneric"),
        );
        return;
      }
      toast.success(t("createdToast"));
      setOpen(false);
      reset();
      router.push(`/admin/students/${res.id}`);
      router.refresh();
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
        <Button type="button" variant="outline" className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" aria-hidden />
          {t("createButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createHint")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cs-fn">{t("firstNameLabel")} *</Label>
              <Input
                id="cs-fn"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-ln">{t("lastNameLabel")} *</Label>
              <Input
                id="cs-ln"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-em">{t("emailLabel")}</Label>
            <Input
              id="cs-em"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-cl">{t("classLabel")}</Label>
            <select
              id="cs-cl"
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
              <Label htmlFor="cs-bd">{t("birthDateLabel")}</Label>
              <Input
                id="cs-bd"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-sx">{t("sexLabel")}</Label>
              <select
                id="cs-sx"
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
            <Label htmlFor="cs-bp">{t("birthPlaceLabel")}</Label>
            <Input
              id="cs-bp"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-ed">{t("entryDateLabel")}</Label>
            <Input
              id="cs-ed"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("createSubmit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
