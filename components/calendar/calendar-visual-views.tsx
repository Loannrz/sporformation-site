"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Locale } from "date-fns";
import { addDays, eachDayOfInterval, format, isSameDay, isSameMonth, startOfWeek } from "date-fns";
import {
  isoDateKey,
  monthMatrix,
  overlapsCalendarDay,
  weekDays,
} from "@/components/calendar/calendar-date-utils";

export function CalendarNav({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        {label}
      </h3>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="icon" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onNext}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function CalendarMonthGrid({
  anchorMonth,
  events,
  locale,
  dense,
  onSelectDay,
  onSelectEvent,
  selectedDay,
}: {
  anchorMonth: Date;
  events: CalendarEvent[];
  locale: Locale;
  dense?: boolean;
  onSelectDay?: (day: Date) => void;
  onSelectEvent: (ev: CalendarEvent) => void;
  selectedDay?: Date | null;
}) {
  const weeks = monthMatrix(anchorMonth);
  const hdrStart = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: 1 });
  const WEEKDAY_LABELS = eachDayOfInterval({
    start: hdrStart,
    end: addDays(hdrStart, 6),
  }).map((d) => format(d, "EEEEEE", { locale }));

  const cellPad = dense ? "min-h-20 md:min-h-24 lg:min-h-28 p-2" : "min-h-24 md:min-h-28 p-2";

  return (
    <div className="rounded-2xl border border-border bg-card/40">
      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {WEEKDAY_LABELS.map((lbl, i) => (
          <div
            key={`wd-${i}`}
            className="border-r border-border/60 py-2 last:border-r-0"
          >
            {lbl}
          </div>
        ))}
      </div>
      {weeks.map((row, wi) => (
        <div
          key={`w-${wi}`}
          className="grid grid-cols-7 border-b border-border/80 last:border-b-0"
        >
          {row.map((day) => {
            const inMonth = isSameMonth(day, anchorMonth);
            const sel = selectedDay && isSameDay(day, selectedDay);
            const dayEvents = events.filter((ev) => overlapsCalendarDay(day, ev));
            return (
              <button
                key={isoDateKey(day)}
                type="button"
                onClick={() => onSelectDay?.(day)}
                className={cn(
                  "relative border-r border-border/70 text-left transition last:border-r-0",
                  cellPad,
                  inMonth ? "bg-card text-foreground" : "bg-muted/15 text-muted-foreground",
                  sel && "ring-2 ring-primary/40 ring-inset",
                )}
              >
                <span className="text-[13px] font-semibold">{format(day, "d")}</span>
                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, dense ? 3 : 5).map((ev) => (
                    <button
                      key={ev.id + isoDateKey(day)}
                      type="button"
                      className={cn(
                        "line-clamp-2 w-full rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium shadow-sm hover:brightness-105",
                        ev.personal ? "border border-dashed bg-muted text-foreground" : "border-l-[3px] border-l-primary bg-primary/12",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      title={ev.title}
                    >
                      {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > (dense ? 3 : 5) ? (
                    <p className="text-[9px] text-muted-foreground">+{dayEvents.length - (dense ? 3 : 5)}</p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function CalendarWeekColumns({
  weekAnchor,
  events,
  locale,
  onSelectEvent,
}: {
  weekAnchor: Date;
  events: CalendarEvent[];
  locale: Locale;
  onSelectEvent: (ev: CalendarEvent) => void;
}) {
  const days = weekDays(weekAnchor);
  const WEEKDAY_LABELS = days.map((d) => ({
    dow: format(d, "EEEEEE", { locale }),
    num: format(d, "d MMM", { locale }),
  }));

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-x-auto">
      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(11rem,1fr))` }}
      >
        {days.map((day, idx) => {
          const cellEvents = events.filter((ev) => overlapsCalendarDay(day, ev));
          return (
            <div key={isoDateKey(day)} className="border-r border-border/80 bg-card p-3 last:border-r-0">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                {WEEKDAY_LABELS[idx].dow}
              </p>
              <p className="text-sm font-semibold">{WEEKDAY_LABELS[idx].num}</p>
              <div className="mt-4 space-y-2">
                {cellEvents.map((ev) => (
                  <button
                    key={`${ev.id}-${idx}`}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border px-2 py-2 text-left text-xs transition hover:bg-muted/50",
                      ev.personal ? "border-dashed" : "border-l-4 border-l-primary shadow-sm",
                    )}
                    onClick={() => onSelectEvent(ev)}
                  >
                    <p className="line-clamp-2 font-semibold">{ev.title}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(ev.start), "HH:mm", { locale })} —
                      {format(new Date(ev.end), "HH:mm", { locale })}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarSingleDayEvents({
  day,
  events,
  locale,
  onSelectEvent,
  emptyLabel = "—",
}: {
  day: Date;
  events: CalendarEvent[];
  locale: Locale;
  onSelectEvent: (ev: CalendarEvent) => void;
  emptyLabel?: string;
}) {
  const list = events.filter((ev) => overlapsCalendarDay(day, ev));
  list.sort(
    (a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">
        {format(day, "EEEE d MMMM yyyy", { locale })}
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((ev) => (
            <li key={ev.id}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted/50",
                  ev.personal ? "border-dashed bg-muted/20" : "border-l-4 border-l-primary",
                )}
                onClick={() => onSelectEvent(ev)}
              >
                <span className="font-semibold">{ev.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {format(new Date(ev.start), "HH:mm", { locale })}
                  {" · "}
                  {format(new Date(ev.end), "HH:mm", { locale })}
                </span>
                {ev.description?.trim() ? (
                  <span className="mt-2 block whitespace-pre-wrap text-xs text-muted-foreground">
                    {ev.description.trim()}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
