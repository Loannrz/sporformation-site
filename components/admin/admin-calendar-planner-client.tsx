"use client";

import { SchoolCalendarCreateForm } from "@/components/admin/school-calendar-create-form";
import { CalendarEventDetailDialog } from "@/components/calendar/calendar-event-detail-dialog";
import {
  addDaySafe,
  addMonthSafe,
  addWeekSafe,
} from "@/components/calendar/calendar-date-utils";
import {
  CalendarMonthGrid,
  CalendarNav,
  CalendarSingleDayEvents,
  CalendarWeekColumns,
} from "@/components/calendar/calendar-visual-views";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { CalendarEvent } from "@/types";
import type { AppLocale } from "@/i18n/routing";
import { endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { enUS, fr as frFns } from "date-fns/locale";
import { useTranslations } from "next-intl";
import { CalendarPlus } from "lucide-react";
import { useMemo, useState } from "react";

type TeacherOpt = { id: string; label: string };
type ClassOpt = { id: string; label: string };
type StudentOpt = { id: string; label: string };

type ViewTab = "month" | "week" | "day";

type Props = {
  locale: AppLocale;
  userId: string;
  sharedEvents: CalendarEvent[];
  teachers: TeacherOpt[];
  classes: ClassOpt[];
  students: StudentOpt[];
};

export function AdminCalendarPlannerClient({
  locale,
  userId,
  sharedEvents,
  teachers,
  classes,
  students,
}: Props) {
  const dateLocale = useMemo(
    () => (locale === "fr" ? frFns : enUS),
    [locale],
  );
  const t = useTranslations("admin.calendarSchool");
  const [publishOpen, setPublishOpen] = useState(false);
  const [calendarTab, setCalendarTab] = useState<ViewTab>("month");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

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

  const anchorMonth = startOfMonth(cursorDate);
  const weekAnchor = startOfWeek(cursorDate, { weekStartsOn: 1 });

  const openEvent = (ev: CalendarEvent) => {
    setDetailEvent(ev);
    setDetailOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{t("plannerBoardTitle")}</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              {t("plannerBoardDesc")}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => setPublishOpen(true)}
          >
            <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
            {t("publishTrigger")}
          </Button>
        </div>

        <Tabs
          value={calendarTab}
          onValueChange={(v) => setCalendarTab(v as ViewTab)}
        >
          <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
            <TabsTrigger value="month">{t("tabMonth")}</TabsTrigger>
            <TabsTrigger value="week">{t("tabWeek")}</TabsTrigger>
            <TabsTrigger value="day">{t("tabDay")}</TabsTrigger>
          </TabsList>

          <TabsContent value="month" className="mt-6">
            <CalendarNav label={navLabel} onPrev={navPrev} onNext={navNext} />
            <CalendarMonthGrid
              anchorMonth={anchorMonth}
              events={sharedEvents}
              locale={dateLocale}
              selectedDay={cursorDate}
              onSelectDay={(day) => {
                setCursorDate(day);
                setCalendarTab("day");
              }}
              onSelectEvent={openEvent}
            />
          </TabsContent>

          <TabsContent value="week" className="mt-6">
            <CalendarNav label={navLabel} onPrev={navPrev} onNext={navNext} />
            <CalendarWeekColumns
              weekAnchor={weekAnchor}
              events={sharedEvents}
              locale={dateLocale}
              onSelectEvent={openEvent}
            />
          </TabsContent>

          <TabsContent value="day" className="mt-6">
            <CalendarNav label={navLabel} onPrev={navPrev} onNext={navNext} />
            <CalendarSingleDayEvents
              day={cursorDate}
              events={sharedEvents}
              locale={dateLocale}
              emptyLabel={t("emptyDay")}
              onSelectEvent={openEvent}
            />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-h-[min(92vh,900px)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("publishDialogTitle")}</DialogTitle>
            <DialogDescription>{t("publishDialogHint")}</DialogDescription>
          </DialogHeader>
          <SchoolCalendarCreateForm
            locale={locale}
            teachers={teachers}
            classes={classes}
            students={students}
            embedded
            onPublished={() => setPublishOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <CalendarEventDetailDialog
        locale={locale}
        userId={userId}
        canManageSchool
        event={detailEvent}
        open={detailOpen && !!detailEvent}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailEvent(null);
        }}
      />
    </>
  );
}
