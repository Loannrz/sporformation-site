"use client";

import { createSchoolCalendarEventAction } from "@/app/actions/calendar-events";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { AnnouncementAudience } from "@/types";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent, useId } from "react";
import { toast } from "sonner";

const AUDIENCE_RADIO: readonly (AnnouncementAudience | "SPECIFIC_TARGETS")[] =
  [
    "ALL_STAFF",
    "HEAD_TEACHERS_ONLY",
    "CLASSROOM_TEACHERS",
    "DIRECTION_ONLY",
    "SPECIFIC_TARGETS",
  ];

const KINDS = ["school_event", "meeting", "course", "deadline"] as const;

type TeacherOpt = { id: string; label: string };
type ClassOpt = { id: string; label: string };
type StudentOpt = { id: string; label: string };

export function SchoolCalendarCreateForm(props: {
  locale: AppLocale;
  teachers: TeacherOpt[];
  classes: ClassOpt[];
  students: StudentOpt[];
  /** Formulaire sans carte (ex. dialogue) */
  embedded?: boolean;
  /** Après publication réussie (fermer le dialogue côté parent, etc.) */
  onPublished?: () => void;
}) {
  const { locale, teachers, classes, students, embedded, onPublished } = props;
  const t = useTranslations("admin.calendarSchool");
  const router = useRouter();
  const uid = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("school_event");
  const [audience, setAudience] =
    useState<(typeof AUDIENCE_RADIO)[number]>("ALL_STAFF");
  const [selProfiles, setSelProfiles] = useState<Record<string, boolean>>({});
  const [selClasses, setSelClasses] = useState<Record<string, boolean>>({});
  const [selStudents, setSelStudents] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const raName = `aud-${uid}`;

  function idsFrom(m: Record<string, boolean>): string[] {
    return Object.entries(m)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSchoolCalendarEventAction(locale, {
        title,
        description: description.trim() || undefined,
        startsAt,
        endsAt,
        kind,
        audience,
        profileIds:
          audience === "SPECIFIC_TARGETS" ? idsFrom(selProfiles) : undefined,
        classIds:
          audience === "SPECIFIC_TARGETS" ? idsFrom(selClasses) : undefined,
        studentIds:
          audience === "SPECIFIC_TARGETS" ? idsFrom(selStudents) : undefined,
      });

      if (!res.ok) {
        if (res.error === "NO_SERVICE_ROLE") {
          toast.error(t("toastNoService"));
          return;
        }
        if (res.error === "DATES_REQUIRED") {
          toast.error(t("toastDatesRequired"));
          return;
        }
        if (res.error === "DATES_INVALID") {
          toast.error(t("toastDatesInvalid"));
          return;
        }
        if (res.error === "TARGETS_REQUIRED") {
          toast.error(t("toastTargetsRequired"));
          return;
        }
        if (res.error === "RANGE_INVALID") {
          toast.error(t("toastDatesOrder"));
          return;
        }
        if (res.error === "TARGETS_FAILED") {
          toast.error(t("toastTargetsPersistFailed"));
          return;
        }
        toast.error(t("toastFailed"));
        return;
      }
      toast.success(t("toastSaved"));
      onPublished?.();
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setSelProfiles({});
      setSelClasses({});
      setSelStudents({});
      router.refresh();
    });
  };

  const specific = audience === "SPECIFIC_TARGETS";

  const innerForm = (
    <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={`scf-t-${uid}`}>{t("titleLbl")}</Label>
            <Input
              id={`scf-t-${uid}`}
              value={title}
              maxLength={240}
              disabled={pending}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`scf-d-${uid}`}>{t("descLbl")}</Label>
            <Textarea
              id={`scf-d-${uid}`}
              value={description}
              rows={3}
              disabled={pending}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`scf-s-${uid}`}>{t("startsAt")}</Label>
              <Input
                id={`scf-s-${uid}`}
                type="datetime-local"
                value={startsAt}
                disabled={pending}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`scf-e-${uid}`}>{t("endsAt")}</Label>
              <Input
                id={`scf-e-${uid}`}
                type="datetime-local"
                value={endsAt}
                disabled={pending}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("kindLbl")}</Label>
            <select
              disabled={pending}
              value={kind}
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) =>
                setKind(e.target.value as (typeof KINDS)[number])
              }
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`kind.${k}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <Label>{t("audienceLbl")}</Label>
            <div className="grid gap-2">
              {AUDIENCE_RADIO.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    className="mt-1"
                    name={raName}
                    checked={audience === key}
                    disabled={pending}
                    onChange={() => setAudience(key)}
                  />
                  <span>
                    <span className="font-medium">{t(`aud.${key}`)}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t(`audHint.${key}`)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {specific ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <fieldset className="space-y-2 rounded-lg border p-3">
                <legend className="px-2 text-xs font-semibold">
                  {t("pickTeachers")}
                </legend>
                <ScrollArea className="h-44 pr-4">
                  <ul className="space-y-2">
                    {teachers.map((p) => (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!selProfiles[p.id]}
                            disabled={pending}
                            onChange={() =>
                              setSelProfiles((prev) => ({
                                ...prev,
                                [p.id]: !prev[p.id],
                              }))
                            }
                          />
                          <span>{p.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </fieldset>

              <fieldset className="space-y-2 rounded-lg border p-3">
                <legend className="px-2 text-xs font-semibold">
                  {t("pickClasses")}
                </legend>
                <ScrollArea className="h-44 pr-4">
                  <ul className="space-y-2">
                    {classes.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!selClasses[c.id]}
                            disabled={pending}
                            onChange={() =>
                              setSelClasses((prev) => ({
                                ...prev,
                                [c.id]: !prev[c.id],
                              }))
                            }
                          />
                          <span>{c.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </fieldset>

              <fieldset className="space-y-2 rounded-lg border p-3">
                <legend className="px-2 text-xs font-semibold">
                  {t("pickStudents")}
                </legend>
                <ScrollArea className="h-44 pr-4">
                  <ul className="space-y-2">
                    {students.map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!selStudents[s.id]}
                            disabled={pending}
                            onChange={() =>
                              setSelStudents((prev) => ({
                                ...prev,
                                [s.id]: !prev[s.id],
                              }))
                            }
                          />
                          <span>{s.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </fieldset>
            </div>
          ) : null}

      <Button type="submit" disabled={pending || !title.trim()}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );

  if (embedded) {
    return innerForm;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("formTitle")}</CardTitle>
        <CardDescription>{t("formDesc")}</CardDescription>
      </CardHeader>
      <CardContent>{innerForm}</CardContent>
    </Card>
  );
}
