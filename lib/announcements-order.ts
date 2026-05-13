import type { Announcement } from "@/types";

/** Urgent d’abord, puis par date décroissante (comme tableau de bord / bulletin). */
export function orderAnnouncementsForBulletin(rows: Announcement[]): Announcement[] {
  return [...rows].sort((a, b) => {
    if (a.importance === b.importance) {
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return a.importance === "urgent" ? -1 : 1;
  });
}
