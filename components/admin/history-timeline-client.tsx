"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  Activity,
  CalendarDays,
  CircleUserRound,
  FolderTree,
  Gavel,
  GraduationCap,
  LogIn,
  Megaphone,
  MessageSquare,
  Paperclip,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppLocale } from "@/i18n/routing";
import type {
  ActivityCategory,
  ActivityLogRow,
} from "@/lib/data/activity-logs";
import { categoryForAction } from "@/lib/data/activity-logs";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type Props = {
  locale: AppLocale;
  rows: ActivityLogRow[];
  categories: ActivityCategory[];
};

type CategoryAccent = {
  text: string;
  ring: string;
  glow: string;
  surface: string;
  badge: string;
  dotFrom: string;
  dotTo: string;
};

const CATEGORY_ACCENT: Record<ActivityCategory, CategoryAccent> = {
  auth: {
    text: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-400/50",
    glow: "shadow-[0_0_22px_rgba(56,189,248,0.45)]",
    surface:
      "bg-gradient-to-br from-sky-50 via-sky-50/60 to-transparent dark:from-sky-500/10 dark:via-sky-500/5",
    badge:
      "bg-sky-500/10 text-sky-700 border-sky-300/50 dark:text-sky-300 dark:border-sky-400/30",
    dotFrom: "from-sky-300",
    dotTo: "to-sky-600",
  },
  files: {
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-400/50",
    glow: "shadow-[0_0_22px_rgba(245,158,11,0.45)]",
    surface:
      "bg-gradient-to-br from-amber-50 via-amber-50/60 to-transparent dark:from-amber-500/10 dark:via-amber-500/5",
    badge:
      "bg-amber-500/10 text-amber-700 border-amber-300/50 dark:text-amber-300 dark:border-amber-400/30",
    dotFrom: "from-amber-300",
    dotTo: "to-amber-600",
  },
  folders: {
    text: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-400/50",
    glow: "shadow-[0_0_22px_rgba(249,115,22,0.45)]",
    surface:
      "bg-gradient-to-br from-orange-50 via-orange-50/60 to-transparent dark:from-orange-500/10 dark:via-orange-500/5",
    badge:
      "bg-orange-500/10 text-orange-700 border-orange-300/50 dark:text-orange-300 dark:border-orange-400/30",
    dotFrom: "from-orange-300",
    dotTo: "to-orange-600",
  },
  messaging: {
    text: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-400/50",
    glow: "shadow-[0_0_22px_rgba(139,92,246,0.45)]",
    surface:
      "bg-gradient-to-br from-violet-50 via-violet-50/60 to-transparent dark:from-violet-500/10 dark:via-violet-500/5",
    badge:
      "bg-violet-500/10 text-violet-700 border-violet-300/50 dark:text-violet-300 dark:border-violet-400/30",
    dotFrom: "from-violet-300",
    dotTo: "to-violet-600",
  },
  accounts: {
    text: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-400/50",
    glow: "shadow-[0_0_22px_rgba(99,102,241,0.45)]",
    surface:
      "bg-gradient-to-br from-indigo-50 via-indigo-50/60 to-transparent dark:from-indigo-500/10 dark:via-indigo-500/5",
    badge:
      "bg-indigo-500/10 text-indigo-700 border-indigo-300/50 dark:text-indigo-300 dark:border-indigo-400/30",
    dotFrom: "from-indigo-300",
    dotTo: "to-indigo-600",
  },
  students: {
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-400/50",
    glow: "shadow-[0_0_22px_rgba(16,185,129,0.45)]",
    surface:
      "bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/5",
    badge:
      "bg-emerald-500/10 text-emerald-700 border-emerald-300/50 dark:text-emerald-300 dark:border-emerald-400/30",
    dotFrom: "from-emerald-300",
    dotTo: "to-emerald-600",
  },
  classes: {
    text: "text-teal-700 dark:text-teal-300",
    ring: "ring-teal-400/50",
    glow: "shadow-[0_0_22px_rgba(20,184,166,0.45)]",
    surface:
      "bg-gradient-to-br from-teal-50 via-teal-50/60 to-transparent dark:from-teal-500/10 dark:via-teal-500/5",
    badge:
      "bg-teal-500/10 text-teal-700 border-teal-300/50 dark:text-teal-300 dark:border-teal-400/30",
    dotFrom: "from-teal-300",
    dotTo: "to-teal-600",
  },
  announcements: {
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-400/50",
    glow: "shadow-[0_0_22px_rgba(244,63,94,0.45)]",
    surface:
      "bg-gradient-to-br from-rose-50 via-rose-50/60 to-transparent dark:from-rose-500/10 dark:via-rose-500/5",
    badge:
      "bg-rose-500/10 text-rose-700 border-rose-300/50 dark:text-rose-300 dark:border-rose-400/30",
    dotFrom: "from-rose-300",
    dotTo: "to-rose-600",
  },
  sanctions: {
    text: "text-red-700 dark:text-red-300",
    ring: "ring-red-400/50",
    glow: "shadow-[0_0_22px_rgba(239,68,68,0.45)]",
    surface:
      "bg-gradient-to-br from-red-50 via-red-50/60 to-transparent dark:from-red-500/10 dark:via-red-500/5",
    badge:
      "bg-red-500/10 text-red-700 border-red-300/50 dark:text-red-300 dark:border-red-400/30",
    dotFrom: "from-red-300",
    dotTo: "to-red-600",
  },
  calendar: {
    text: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-400/50",
    glow: "shadow-[0_0_22px_rgba(6,182,212,0.45)]",
    surface:
      "bg-gradient-to-br from-cyan-50 via-cyan-50/60 to-transparent dark:from-cyan-500/10 dark:via-cyan-500/5",
    badge:
      "bg-cyan-500/10 text-cyan-700 border-cyan-300/50 dark:text-cyan-300 dark:border-cyan-400/30",
    dotFrom: "from-cyan-300",
    dotTo: "to-cyan-600",
  },
  profile: {
    text: "text-fuchsia-700 dark:text-fuchsia-300",
    ring: "ring-fuchsia-400/50",
    glow: "shadow-[0_0_22px_rgba(217,70,239,0.45)]",
    surface:
      "bg-gradient-to-br from-fuchsia-50 via-fuchsia-50/60 to-transparent dark:from-fuchsia-500/10 dark:via-fuchsia-500/5",
    badge:
      "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-300/50 dark:text-fuchsia-300 dark:border-fuchsia-400/30",
    dotFrom: "from-fuchsia-300",
    dotTo: "to-fuchsia-600",
  },
};

const CATEGORY_ICON: Record<ActivityCategory, LucideIcon> = {
  auth: LogIn,
  files: Upload,
  folders: FolderTree,
  messaging: MessageSquare,
  accounts: Users,
  students: GraduationCap,
  classes: GraduationCap,
  announcements: Megaphone,
  sanctions: Gavel,
  calendar: CalendarDays,
  profile: Settings,
};

const ACTION_ICON: Partial<Record<string, LucideIcon>> = {
  AUTH_SIGN_IN_FIRST: Sparkles,
  AUTH_SIGN_IN: LogIn,
  FILE_UPLOADED: Upload,
  FILE_METADATA_UPDATED: Activity,
  FOLDER_DELETED: Trash2,
  STAFF_DELETED: Trash2,
  STUDENT_DELETED: Trash2,
  STUDENTS_BULK_DELETED: Trash2,
  CLASS_DELETED: Trash2,
  ANNOUNCEMENT_DELETED: Trash2,
  SANCTION_DELETED: Trash2,
  CALENDAR_EVENT_DELETED: Trash2,
  STUDENT_INBOX_SUBFOLDER_CREATED: FolderTree,
  MESSAGE_SENT: MessageSquare,
  MESSAGE_CONVERSATION_CREATED_DIRECT: MessageSquare,
  MESSAGE_CONVERSATION_CREATED_GROUP: MessageSquare,
};

function getMeta<T>(row: ActivityLogRow, key: string): T | undefined {
  const m = row.meta ?? {};
  return (m as Record<string, unknown>)[key] as T | undefined;
}

function initialsFromLabel(label: string | null | undefined): string {
  if (!label) return "?";
  const parts = label.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function HistoryTimelineClient({ locale, rows, categories }: Props) {
  const t = useTranslations("admin.history");
  const dLocale = locale === "fr" ? fr : enUS;
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Set<ActivityCategory>>(new Set());

  const toggleCategory = (cat: ActivityCategory) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      const cat = categoryForAction(r.action);
      if (active.size > 0 && !active.has(cat)) return false;
      if (!needle) return true;
      const actorLabel = String(getMeta<string>(r, "actor_label") ?? "");
      const entityLabel = String(getMeta<string>(r, "entity_label") ?? "");
      const blob =
        `${actorLabel} ${entityLabel} ${r.action} ${r.entity_type ?? ""} ${JSON.stringify(
          r.meta ?? {},
        )}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, search, active]);

  const stats = useMemo(() => {
    const now = new Date();
    let today = 0;
    let yesterday = 0;
    let firstSignIns = 0;
    const actors = new Set<string>();
    for (const r of rows) {
      const d = new Date(r.created_at);
      if (isSameDay(d, now)) today += 1;
      else if (isYesterday(d)) yesterday += 1;
      if (r.action === "AUTH_SIGN_IN_FIRST") firstSignIns += 1;
      if (r.actor_id) actors.add(r.actor_id);
    }
    return {
      today,
      yesterday,
      total: rows.length,
      actors: actors.size,
      firstSignIns,
    };
  }, [rows]);

  const groups = useMemo(() => {
    const out = new Map<string, { date: Date; rows: ActivityLogRow[] }>();
    for (const r of filteredRows) {
      const d = new Date(r.created_at);
      const key = dayKey(d);
      const bucket = out.get(key);
      if (bucket) bucket.rows.push(r);
      else out.set(key, { date: d, rows: [r] });
    }
    return Array.from(out.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );
  }, [filteredRows]);

  const formatDayHeader = (d: Date) => {
    if (isToday(d)) return t("today");
    if (isYesterday(d)) return t("yesterday");
    return format(d, "EEEE d MMMM yyyy", { locale: dLocale });
  };

  return (
    <div className="space-y-10">
      <section
        className={cn(
          "relative isolate overflow-hidden rounded-3xl border border-border p-8 sm:p-10",
          "gradient-mesh dark:gradient-mesh-dark",
        )}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-60">
          <div className="absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-32 right-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[260px] space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
              <Activity className="h-3.5 w-3.5" />
              {t("eyebrow")}
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t("statToday")} value={stats.today} accent="from-primary to-accent" />
            <StatCard
              label={t("statYesterday")}
              value={stats.yesterday}
              accent="from-violet-500 to-fuchsia-400"
            />
            <StatCard
              label={t("statFirstSignIns")}
              value={stats.firstSignIns}
              accent="from-sky-500 to-cyan-400"
            />
            <StatCard
              label={t("statActors")}
              value={stats.actors}
              accent="from-emerald-500 to-teal-400"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          {active.size > 0 ? (
            <button
              type="button"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
              onClick={() => setActive(new Set())}
            >
              {t("clearFilters")}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const accent = CATEGORY_ACCENT[cat];
            const Icon = CATEGORY_ICON[cat];
            const isActive = active.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                  "hover:-translate-y-0.5 hover:shadow-soft dark:hover:shadow-soft-dark",
                  isActive
                    ? cn(accent.badge, "ring-2", accent.ring)
                    : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(`category.${cat}`)}
              </button>
            );
          })}
        </div>
      </section>

      {filteredRows.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border bg-background/50 p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-medium">{t("emptyTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyDesc")}</p>
        </section>
      ) : (
        <section className="relative">
          {/* Spine */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[1.55rem] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent sm:left-[1.75rem]"
          />

          <ol className="space-y-10">
            {groups.map((grp) => (
              <li key={grp.date.toISOString()} className="space-y-4">
                <div className="sticky top-2 z-10 flex items-center gap-3">
                  <span className="grid place-items-center rounded-full border border-border bg-background/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shadow-soft backdrop-blur dark:shadow-soft-dark">
                    {formatDayHeader(grp.date)}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    {t("eventCount", { count: grp.rows.length })}
                  </span>
                </div>
                <ul className="space-y-3">
                  {grp.rows.map((row) => (
                    <TimelineRow
                      key={row.id}
                      row={row}
                      locale={locale}
                      dLocale={dLocale}
                      t={(k: string, params?: Record<string, unknown>) =>
                        t(k, params as never)
                      }
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-background/70 px-4 py-3 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-soft dark:hover:shadow-soft-dark">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-90",
          accent,
        )}
      />
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TimelineRow({
  row,
  locale,
  dLocale,
  t,
}: {
  row: ActivityLogRow;
  locale: AppLocale;
  dLocale: Locale;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const category = categoryForAction(row.action);
  const accent = CATEGORY_ACCENT[category];
  const Icon = ACTION_ICON[row.action] ?? CATEGORY_ICON[category];

  const actorLabel = getMeta<string>(row, "actor_label") ?? null;
  const actorRole = getMeta<string>(row, "actor_role") ?? null;
  const entityLabel = getMeta<string>(row, "entity_label") ?? null;

  const date = new Date(row.created_at);
  const timeStr = format(date, locale === "fr" ? "HH:mm" : "p", {
    locale: dLocale,
  });
  const dateFull = format(date, locale === "fr" ? "d MMM yyyy · HH:mm" : "PP · p", {
    locale: dLocale,
  });

  const actionLabel = safeT(t, `action.${row.action}`, row.action, {
    target: entityLabel ?? "—",
  });
  const roleLabel = actorRole ? safeT(t, `role.${actorRole}`, actorRole) : null;

  return (
    <li
      className={cn(
        "group relative ml-0 sm:ml-2 rounded-2xl border border-border/80 bg-background/85 p-4 pr-5 transition",
        "hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-soft dark:hover:shadow-soft-dark",
        accent.surface,
      )}
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className={cn(
            "relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background ring-2 transition",
            accent.ring,
            "group-hover:scale-105",
            accent.glow,
          )}
        >
          <div
            className={cn(
              "absolute inset-0 rounded-full bg-gradient-to-br opacity-25",
              `bg-gradient-to-br ${accent.dotFrom} ${accent.dotTo}`,
            )}
          />
          <Icon className={cn("relative h-5 w-5", accent.text)} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className={cn("text-sm font-semibold", accent.text)}>
              {actorLabel ?? t("unknownActor")}
            </span>
            {roleLabel ? (
              <span className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {roleLabel}
              </span>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <CircleUserRound className="h-3 w-3 opacity-70" />
              <span>{initialsFromLabel(actorLabel)}</span>
              <span className="opacity-40">·</span>
              <time dateTime={row.created_at} title={dateFull}>
                {timeStr}
              </time>
            </span>
          </div>

          <p className="text-sm leading-relaxed text-foreground">
            {actionLabel}
            {entityLabel ? (
              <span
                className={cn(
                  "ml-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 align-baseline text-[12px] font-medium",
                  accent.badge,
                )}
              >
                <span className="truncate max-w-[18ch] sm:max-w-[40ch]">
                  {entityLabel}
                </span>
              </span>
            ) : null}
          </p>

          <RowDetails row={row} accent={accent} t={t} />
        </div>
      </div>
    </li>
  );
}

function RowDetails({
  row,
  accent,
  t,
}: {
  row: ActivityLogRow;
  accent: CategoryAccent;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const chips: Array<{ icon?: LucideIcon; label: string }> = [];

  if (row.action === "MESSAGE_SENT") {
    const preview = String(meta.preview ?? "");
    const hasAttachment = Boolean(meta.has_attachment);
    if (preview) {
      return (
        <div className="space-y-1">
          <blockquote
            className={cn(
              "rounded-xl border border-l-4 bg-background/70 px-3 py-2 text-sm italic text-muted-foreground",
              accent.badge,
            )}
          >
            “{preview}”
          </blockquote>
          {hasAttachment ? (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              {String(meta.attachment_filename ?? t("attachmentGeneric"))}
            </div>
          ) : null}
        </div>
      );
    }
    if (hasAttachment) {
      chips.push({
        icon: Paperclip,
        label: String(meta.attachment_filename ?? t("attachmentGeneric")),
      });
    }
  }

  if (row.action === "FILE_UPLOADED") {
    const sizeBytes = Number(meta.size_bytes ?? 0);
    if (sizeBytes > 0) {
      chips.push({
        label: humanFileSize(sizeBytes),
      });
    }
    if (meta.version) {
      chips.push({
        label: `v${meta.version}`,
      });
    }
  }

  if (row.action === "STUDENTS_BULK_DELETED") {
    const count = Number(meta.deleted_count ?? 0);
    if (count > 0) {
      chips.push({
        label: t("chip.deletedCount", { count }),
      });
    }
  }

  if (row.action === "STUDENTS_IMPORTED") {
    if (meta.created) {
      chips.push({ label: t("chip.created", { count: Number(meta.created) }) });
    }
    if (meta.updated) {
      chips.push({ label: t("chip.updated", { count: Number(meta.updated) }) });
    }
    if (meta.skipped) {
      chips.push({ label: t("chip.skipped", { count: Number(meta.skipped) }) });
    }
  }

  if (row.action === "SANCTION_REPORTS_CREATED") {
    const cnt = Number(meta.affected_count ?? 0);
    if (cnt > 0) {
      chips.push({ label: t("chip.affected", { count: cnt }) });
    }
  }

  if (row.action === "MESSAGE_CONVERSATION_CREATED_GROUP") {
    const cnt = Number(meta.member_count ?? 0);
    if (cnt > 0) {
      chips.push({ label: t("chip.members", { count: cnt }) });
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c, i) => {
        const ChipIcon = c.icon;
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            {ChipIcon ? <ChipIcon className="h-3 w-3" /> : null}
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

function safeT(
  t: (key: string, params?: Record<string, unknown>) => string,
  key: string,
  fallback: string,
  params?: Record<string, unknown>,
): string {
  try {
    const out = t(key, params);
    if (!out || out === key) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

function humanFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "kB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

type Locale = typeof fr;
