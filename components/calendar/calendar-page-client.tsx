"use client";

import {
  createPersonalCalendarEventAction,
  deleteCalendarEventAction,
} from "@/app/actions/calendar-events";
import { CalendarEventDetailDialog } from "@/components/calendar/calendar-event-detail-dialog";
import {
  addDaySafe,
  addMonthSafe,
  addWeekSafe,
  formatCalendarRangeLine,
} from "@/components/calendar/calendar-date-utils";
import {
  CalendarMonthGrid,
  CalendarNav,
  CalendarSingleDayEvents,
  CalendarWeekColumns,
} from "@/components/calendar/calendar-visual-views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { CalendarEvent } from "@/types";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { enUS, fr as frFns } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import {
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Filter = "all" | "mine" | "shared";

type ViewTab = "month" | "week" | "day";

type Props = {
  locale: AppLocale;
  userId: string;
  /** Direction / administration : suppression des agendas partagés */
  canManageSchool: boolean;
  events: CalendarEvent[];
};

export function CalendarPageClient({
  locale,
  userId,
  canManageSchool,
  events,
}: Props) {
  const dateLocale = useMemo(
    () => (locale === "fr" ? frFns : enUS),
    [locale],
  );
  const t = useTranslations("calendar");
  const router = useRouter();
  const formId = useId();
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [calendarTab, setCalendarTab] = useState<ViewTab>("month");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case "mine":
        return events.filter((e) => e.personal);
      case "shared":
        return events.filter((e) => !e.personal);
      default:
        return events;
    }
  }, [events, filter]);

  const upcomingPreview = useMemo(() => {
    const nowMs = Date.now();
    return [...filtered]
      .filter((e) => new Date(e.end).getTime() >= nowMs)
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime(),
      )
      .slice(0, 3);
  }, [filtered]);

  const navLabel = useMemo(() => {
    const wk = { weekStartsOn: 1 as const };
    if (calendarTab === "month") {
      return format(cursorDate, "MMMM yyyy", { locale: dateLocale });
    }
    if (calendarTab === "week") {
      const s = startOfWeek(cursorDate, wk);
      const e = endOfWeek(cursorDate, wk);
      return `${format(s, "d MMM", { locale: dateLocale })} — ${format(e, "d MMM yyyy", { locale: dateLocale })}`;
    }
    return format(cursorDate, "EEEE d MMMM yyyy", { locale: dateLocale });
  }, [calendarTab, cursorDate, dateLocale]);

  const resetPersonalForm = () => {
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
  };

  const submitPersonal = () => {
    startTransition(async () => {
      const res = await createPersonalCalendarEventAction(locale, {
        title,
        startsAt,
        endsAt,
        description: description || undefined,
        kind: "school_event",
      });
      if (!res.ok) {
        if (res.error === "NO_SERVICE_ROLE") {
          toast.error(t("toastNoService"));
          return;
        }
        if (res.error === "DATES_REQUIRED") {
          toast.error(t("datesRequiredToast"));
          return;
        }
        if (res.error === "DATES_INVALID") {
          toast.error(t("toastDatesInvalid"));
          return;
        }
        if (res.error === "RANGE_INVALID") {
          toast.error(t("toastDatesOrder"));
          return;
        }
        toast.error(t("toastPersonalFailed"));
        return;
      }
      toast.success(t("toastPersonalSaved"));
      resetPersonalForm();
      setCreateOpen(false);
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteCalendarEventAction(locale, deleteTarget.id);
      if (!res.ok) {
        toast.error(t("toastDeleteFailed"));
        return;
      }
      toast.success(t("toastDeleted"));
      setDeleteTarget(null);
      router.refresh();
    });
  };

  const canDelete = (ev: CalendarEvent) => {
    if (ev.personal) return ev.createdBy === userId;
    return canManageSchool;
  };

  const navPrev = () => {
    if (calendarTab === "month") {
      setCursorDate((d) => addMonthSafe(d, -1));
    } else if (calendarTab === "week") {
      setCursorDate((d) => addWeekSafe(d, -1));
    } else {
      setCursorDate((d) => addDaySafe(d, -1));
    }
  };

  const navNext = () => {
    if (calendarTab === "month") {
      setCursorDate((d) => addMonthSafe(d, 1));
    } else if (calendarTab === "week") {
      setCursorDate((d) => addWeekSafe(d, 1));
    } else {
      setCursorDate((d) => addDaySafe(d, 1));
    }
  };

  const openEventDetail = (ev: CalendarEvent) => {
    setDetailEvent(ev);
    setDetailOpen(true);
  };

  const anchorMonth = startOfMonth(cursorDate);
  const weekAnchor = startOfWeek(cursorDate, { weekStartsOn: 1 });

  const renderMini = (ev: CalendarEvent) => (
    <article
      key={ev.id}
      role="button"
      tabIndex={0}
      onClick={() => openEventDetail(ev)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openEventDetail(ev);
        }
      }}
      className={
        ev.personal
          ? "cursor-pointer rounded-xl border border-dashed border-border bg-muted/20 p-4 outline-none transition hover:bg-muted/30"
          : "cursor-pointer rounded-xl border-l-4 border-l-primary bg-card p-4 shadow-sm outline-none transition hover:bg-muted/20"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ev.personal ? "secondary" : "default"}>
              {ev.personal ? t("badgePersonal") : t("badgeSchool")}
            </Badge>
            <span className="text-xs uppercase text-muted-foreground">
              {t(`kind.${ev.type}`)}
            </span>
          </div>
          <p className="font-semibold leading-snug">{ev.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatCalendarRangeLine(locale, ev.start, ev.end)}
          </p>
          {ev.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {ev.description}
            </p>
          ) : null}
          {!ev.personal && ev.audience ? (
            <p className="text-[11px] text-muted-foreground">
              {t("schoolAudience")}
              {": "}
              {t(`aud.${ev.audience}`)}
            </p>
          ) : null}
        </div>
        {canDelete(ev) ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(ev);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </article>
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={filter === "all" ? "default" : "outline"}
            className="cursor-pointer text-xs font-normal"
            onClick={() => setFilter("all")}
          >
            {t("filterAll")}
          </Badge>
          <Badge
            variant={filter === "mine" ? "default" : "outline"}
            className="cursor-pointer text-xs font-normal"
            onClick={() => setFilter("mine")}
          >
            {t("filterMine")}
          </Badge>
          <Badge
            variant={filter === "shared" ? "default" : "outline"}
            className="cursor-pointer text-xs font-normal"
            onClick={() => setFilter("shared")}
          >
            {t("filterShared")}
          </Badge>
        </div>
        <Button size="sm" type="button" onClick={() => setCreateOpen(true)}>
          {t("addPersonal")}
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("previewUpcoming")}
            </h3>
            <div className="space-y-3">
              {upcomingPreview.map(renderMini)}
            </div>
          </section>
        </CardContent>
      </Card>

      <Tabs
        value={calendarTab}
        onValueChange={(v) => setCalendarTab(v as ViewTab)}
        className="mt-10"
      >
        <TabsList>
          <TabsTrigger value="month">{t("monthly")}</TabsTrigger>
          <TabsTrigger value="week">{t("weekly")}</TabsTrigger>
          <TabsTrigger value="day">{t("daily")}</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="mt-6">
          <CalendarNav label={navLabel} onPrev={navPrev} onNext={navNext} />
          <CalendarMonthGrid
            anchorMonth={anchorMonth}
            events={filtered}
            locale={dateLocale}
            dense
            selectedDay={cursorDate}
            onSelectDay={(day) => {
              setCursorDate(day);
              setCalendarTab("day");
            }}
            onSelectEvent={openEventDetail}
          />
        </TabsContent>

        <TabsContent value="week" className="mt-6">
          <CalendarNav label={navLabel} onPrev={navPrev} onNext={navNext} />
          <CalendarWeekColumns
            weekAnchor={weekAnchor}
            events={filtered}
            locale={dateLocale}
            onSelectEvent={openEventDetail}
          />
        </TabsContent>

        <TabsContent value="day" className="mt-6">
          <CalendarNav label={navLabel} onPrev={navPrev} onNext={navNext} />
          <CalendarSingleDayEvents
            day={cursorDate}
            events={filtered}
            locale={dateLocale}
            emptyLabel={t("emptyDay")}
            onSelectEvent={openEventDetail}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("personalDialogTitle")}</DialogTitle>
            <DialogDescription>{t("personalDialogHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`pct-${formId}-t`}>{t("personalTitleLbl")}</Label>
              <Input
                id={`pct-${formId}-t`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={240}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pct-${formId}-d`}>
                {t("personalDescLbl")}
              </Label>
              <Textarea
                id={`pct-${formId}-d`}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`pct-${formId}-s`}>{t("startsAt")}</Label>
                <Input
                  id={`pct-${formId}-s`}
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pct-${formId}-e`}>{t("endsAt")}</Label>
                <Input
                  id={`pct-${formId}-e`}
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending || !title.trim()}
              onClick={() => submitPersonal()}
            >
              {t("savePersonal")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CalendarEventDetailDialog
        locale={locale}
        userId={userId}
        canManageSchool={canManageSchool}
        event={detailEvent}
        open={detailOpen && !!detailEvent}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailEvent(null);
        }}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmDelete}
            >
              {t("confirmDelete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
