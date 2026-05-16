import type { AnnouncementAudience, UserRole } from "@/types";

/** True si une annonce d’audience `audience` doit être visible pour un utilisateur métier `role`. */
export function viewerSeesAnnouncement(
  role: UserRole,
  audience: AnnouncementAudience,
): boolean {
  switch (audience) {
    case "ALL_STAFF":
      return true;
    case "DIRECTION_ONLY":
      return role === "DIRECTEUR" || role === "ADMINISTRATEUR";
    case "HEAD_TEACHERS_ONLY":
      return role === "PROF_PRINCIPAL";
    case "CLASSROOM_TEACHERS":
      return (
        role === "PROFESSEUR" ||
        role === "PROF_PRINCIPAL" ||
        role === "PEDAGO"
      );
    default:
      return true;
  }
}

export function normalizeAnnouncementAudience(
  raw: string | null | undefined,
): AnnouncementAudience {
  if (
    raw === "ALL_STAFF" ||
    raw === "DIRECTION_ONLY" ||
    raw === "HEAD_TEACHERS_ONLY" ||
    raw === "CLASSROOM_TEACHERS"
  ) {
    return raw;
  }
  return "ALL_STAFF";
}
