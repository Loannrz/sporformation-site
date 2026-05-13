import {
  addDays,
  addMonths,
  areIntervalsOverlapping,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  formatISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, fr as frFns } from "date-fns/locale";
import type { AppLocale } from "@/i18n/routing";
import type { CalendarEvent } from "@/types";

const WEEK_OPTS = { weekStartsOn: 1 as const };

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function overlapsCalendarDay(day: Date, ev: CalendarEvent): boolean {
  const dStart = startOfDay(day);
  const dEnd = endOfDay(day);
  return areIntervalsOverlapping(
    { start: dStart, end: dEnd },
    { start: new Date(ev.start), end: new Date(ev.end) },
    { inclusive: true },
  );
}

export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((ev) => overlapsCalendarDay(day, ev));
}

export function monthMatrix(anchorMonth: Date): Date[][] {
  const start = startOfMonth(anchorMonth);
  const end = endOfMonth(anchorMonth);
  const gridStart = startOfWeek(start, WEEK_OPTS);
  const gridEnd = endOfWeek(end, WEEK_OPTS);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function weekDays(anchor: Date): Date[] {
  const s = startOfWeek(anchor, WEEK_OPTS);
  const e = endOfWeek(anchor, WEEK_OPTS);
  return eachDayOfInterval({ start: s, end: e });
}

export function addMonthSafe(d: Date, delta: number) {
  return addMonths(d, delta);
}

export function addWeekSafe(d: Date, delta: number) {
  return addDays(startOfWeek(d, WEEK_OPTS), delta * 7);
}

export function addDaySafe(d: Date, delta: number) {
  return addDays(d, delta);
}

export function isoDateKey(d: Date) {
  return formatISO(d, { representation: "date" });
}

function capitalizeDisplayLine(line: string, appLocale: AppLocale): string {
  const trimmed = line.trim();
  if (!trimmed) return trimmed;
  return (
    trimmed.charAt(0).toLocaleUpperCase(
      appLocale === "fr" ? "fr" : "en-US",
    ) + trimmed.slice(1)
  );
}

/** Fiche créneau / cartes liste : jour + heures locale (ex. FR « Jeudi 13 mai 2026 · 20:37 — 22:37 »), sans fuseau verbeux. */
export function formatCalendarRangeLine(
  appLocale: AppLocale,
  startIso: string,
  endIso: string,
): string {
  const dl = appLocale === "fr" ? frFns : enUS;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const sameDay =
    format(start, "yyyy-MM-dd", { locale: dl }) ===
    format(end, "yyyy-MM-dd", { locale: dl });

  let line: string;
  if (appLocale === "fr") {
    if (sameDay) {
      line = `${format(start, "EEEE d MMMM yyyy", { locale: dl })} · ${format(start, "HH:mm", { locale: dl })} — ${format(end, "HH:mm", { locale: dl })}`;
    } else {
      line = `${format(start, "EEEE d MMMM yyyy 'à' HH:mm", { locale: dl })} — ${format(end, "EEEE d MMMM yyyy 'à' HH:mm", { locale: dl })}`;
    }
  } else if (sameDay) {
    line = `${format(start, "EEEE, MMMM d, yyyy", { locale: dl })} · ${format(start, "h:mm a", { locale: dl })} — ${format(end, "h:mm a", { locale: dl })}`;
  } else {
    line = `${format(start, "EEE MMM d, yyyy, h:mm a", { locale: dl })} – ${format(end, "EEE MMM d, yyyy, h:mm a", { locale: dl })}`;
  }

  return capitalizeDisplayLine(line, appLocale);
}
