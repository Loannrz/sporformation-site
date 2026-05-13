"use client";

import {
  deleteCalendarEventAction,
  updateCalendarEventAction,
} from "@/app/actions/calendar-events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  formatCalendarRangeLine,
  toDatetimeLocalValue,
} from "@/components/calendar/calendar-date-utils";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import type { CalendarEvent, CalendarEventType } from "@/types";

const KINDS = ["school_event", "meeting", "course", "deadline"] as const;

type Props = {
  locale: AppLocale;
  userId: string;
  canManageSchool: boolean;
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function CalendarEventDetailDialog({
  locale,
  userId,
  canManageSchool,
  event,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations("calendar");
  const router = useRouter();
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [kind, setKind] = useState<CalendarEventType>("school_event");
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, startTransition] = useTransition();

  const canEdit = event
    ? event.personal
      ? event.createdBy === userId
      : canManageSchool
    : false;

  useEffect(() => {
    if (!event) return;
    setEditing(false);
    setTitle(event.title);
    setDesc(event.description ?? "");
    setStarts(toDatetimeLocalValue(event.start));
    setEnds(toDatetimeLocalValue(event.end));
    setKind(event.type);
  }, [event]);

  const saveEdit = () => {
    if (!event) return;
    startTransition(async () => {
      const res = await updateCalendarEventAction(locale, event.id, {
        title,
        startsAt: starts,
        endsAt: ends,
        description: desc,
        kind,
      });
      if (!res.ok) {
        if (res.error === "DATES_REQUIRED") {
          toast.error(t("datesRequiredToast"));
          return;
        }
        if (res.error === "RANGE_INVALID") {
          toast.error(t("toastDatesOrder"));
          return;
        }
        toast.error(t("toastUpdateFailed"));
        return;
      }
      toast.success(t("toastUpdated"));
      setEditing(false);
      onOpenChange(false);
      router.refresh();
    });
  };

  const doDelete = () => {
    if (!event) return;
    startTransition(async () => {
      const res = await deleteCalendarEventAction(locale, event.id);
      setConfirmDel(false);
      if (!res.ok) {
        toast.error(t("toastDeleteFailed"));
        return;
      }
      toast.success(t("toastDeleted"));
      onOpenChange(false);
      router.refresh();
    });
  };

  const dialogTitle = editing ? t("detailEditTitle") : t("detailViewTitle");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {canEdit ? t("detailHintEditable") : t("detailHintReadonly")}
            </DialogDescription>
          </DialogHeader>

          {!event ? null : (
            <>
              {!editing ? (
                <div className="space-y-4 py-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                      {event.personal ? t("badgePersonal") : t("badgeSchool")}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {t(`kind.${event.type}`)}
                    </span>
                  </div>
                  <p className="text-lg font-semibold leading-snug">
                    {event.title}
                  </p>
                  <p className="text-muted-foreground">
                    {formatCalendarRangeLine(locale, event.start, event.end)}
                  </p>
                  {event.description ? (
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {event.description}
                    </p>
                  ) : null}
                  {!event.personal && event.audience ? (
                    <p className="text-xs text-muted-foreground">
                      {t("schoolAudience")}: {t(`aud.${event.audience}`)}
                    </p>
                  ) : null}
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => setEditing(true)}
                      >
                        {t("edit")}
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="destructive"
                        onClick={() => setConfirmDel(true)}
                      >
                        {t("confirmDelete")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor={`ced-t-${uid}`}>{t("personalTitleLbl")}</Label>
                    <Input
                      id={`ced-t-${uid}`}
                      value={title}
                      maxLength={240}
                      disabled={pending}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`ced-d-${uid}`}>{t("personalDescLbl")}</Label>
                    <Textarea
                      id={`ced-d-${uid}`}
                      rows={3}
                      value={desc}
                      disabled={pending}
                      onChange={(e) => setDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`ced-s-${uid}`}>{t("startsAt")}</Label>
                      <Input
                        id={`ced-s-${uid}`}
                        type="datetime-local"
                        value={starts}
                        disabled={pending}
                        onChange={(e) => setStarts(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ced-e-${uid}`}>{t("endsAt")}</Label>
                      <Input
                        id={`ced-e-${uid}`}
                        type="datetime-local"
                        value={ends}
                        disabled={pending}
                        onChange={(e) => setEnds(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("kindLabel")}</Label>
                    <select
                      disabled={pending}
                      value={kind}
                      className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                      onChange={(e) =>
                        setKind(e.target.value as CalendarEventType)
                      }
                    >
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t(`kind.${k}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
          {event && editing ? (
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setTitle(event.title);
                  setDesc(event.description ?? "");
                  setStarts(toDatetimeLocalValue(event.start));
                  setEnds(toDatetimeLocalValue(event.end));
                  setKind(event.type);
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                disabled={pending || !title.trim()}
                onClick={() => saveEdit()}
              >
                {t("save")}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => doDelete()}
            >
              {t("confirmDelete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
