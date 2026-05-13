/** Teintes d’annonce (bordure + fond léger) — clés stables en base. */
export const ANNOUNCEMENT_ACCENT_KEYS = [
  "slate",
  "emerald",
  "rose",
  "sky",
  "amber",
  "violet",
  "orange",
] as const;

export type AnnouncementAccentKey = (typeof ANNOUNCEMENT_ACCENT_KEYS)[number];

export function normalizeAnnouncementAccent(
  raw: string | null | undefined,
): AnnouncementAccentKey {
  if (raw && (ANNOUNCEMENT_ACCENT_KEYS as readonly string[]).includes(raw)) {
    return raw as AnnouncementAccentKey;
  }
  return "slate";
}

/** Conteneur carte annonce (bordure + fond). */
export function announcementAccentArticleClass(key: string): string {
  const k = normalizeAnnouncementAccent(key);
  switch (k) {
    case "emerald":
      return "border-emerald-600/35 bg-emerald-500/[0.08] hover:border-emerald-600/50 dark:border-emerald-500/30 dark:bg-emerald-500/[0.12]";
    case "rose":
      return "border-rose-600/35 bg-rose-500/[0.08] hover:border-rose-600/50 dark:border-rose-500/30 dark:bg-rose-500/[0.12]";
    case "sky":
      return "border-sky-600/35 bg-sky-500/[0.08] hover:border-sky-600/50 dark:border-sky-500/30 dark:bg-sky-500/[0.12]";
    case "amber":
      return "border-amber-600/35 bg-amber-500/[0.08] hover:border-amber-600/50 dark:border-amber-500/30 dark:bg-amber-500/[0.12]";
    case "violet":
      return "border-violet-600/35 bg-violet-500/[0.08] hover:border-violet-600/50 dark:border-violet-500/30 dark:bg-violet-500/[0.12]";
    case "orange":
      return "border-orange-600/35 bg-orange-500/[0.08] hover:border-orange-600/50 dark:border-orange-500/30 dark:bg-orange-500/[0.12]";
    default:
      return "border-border bg-card/70 hover:border-primary/35";
  }
}

/** Couleur icône logo selon la teinte. */
export function announcementAccentIconClass(key: string): string {
  const k = normalizeAnnouncementAccent(key);
  switch (k) {
    case "emerald":
      return "text-emerald-600 dark:text-emerald-400";
    case "rose":
      return "text-rose-600 dark:text-rose-400";
    case "sky":
      return "text-sky-600 dark:text-sky-400";
    case "amber":
      return "text-amber-600 dark:text-amber-400";
    case "violet":
      return "text-violet-600 dark:text-violet-400";
    case "orange":
      return "text-orange-600 dark:text-orange-400";
    default:
      return "text-primary";
  }
}

/** Pastilles de sélection dans les formulaires (Tailwind sécurisé). */
export const ANNOUNCEMENT_ACCENT_SWATCH: Record<
  AnnouncementAccentKey,
  { dot: string; ring: string }
> = {
  slate: { dot: "bg-slate-500", ring: "ring-slate-500" },
  emerald: { dot: "bg-emerald-500", ring: "ring-emerald-500" },
  rose: { dot: "bg-rose-500", ring: "ring-rose-500" },
  sky: { dot: "bg-sky-500", ring: "ring-sky-500" },
  amber: { dot: "bg-amber-500", ring: "ring-amber-500" },
  violet: { dot: "bg-violet-500", ring: "ring-violet-500" },
  orange: { dot: "bg-orange-500", ring: "ring-orange-500" },
};
