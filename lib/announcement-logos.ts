/** Identifiants de logos prédéfinis (persistés dans `announcements.logo_key`). */
export const ANNOUNCEMENT_LOGO_IDS = [
  "megaphone",
  "bell",
  "calendar",
  "graduation",
  "school",
  "info",
  "sparkle",
] as const;

export type AnnouncementLogoId = (typeof ANNOUNCEMENT_LOGO_IDS)[number];

export function normalizeAnnouncementLogoId(
  raw: string | null | undefined,
): AnnouncementLogoId {
  if (raw && (ANNOUNCEMENT_LOGO_IDS as readonly string[]).includes(raw)) {
    return raw as AnnouncementLogoId;
  }
  return "megaphone";
}
