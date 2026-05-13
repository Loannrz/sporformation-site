import type { AnnouncementAudience } from "@/types";
import { viewerSeesAnnouncement } from "@/lib/announcement-audience";
import type { CalendarEventTarget } from "@/types";
import type { SessionUser, UserRole } from "@/types";

export function roleSeesAnnouncementAudience(
  role: UserRole,
  audience: AnnouncementAudience,
): boolean {
  return viewerSeesAnnouncement(role, audience);
}

type RowLike = {
  audience: CalendarSharedAudienceLike | string | null;
  class_id?: string | null;
  teacher_id?: string | null;
};
type CalendarSharedAudienceLike =
  | "ALL_STAFF"
  | "CLASSROOM_TEACHERS"
  | "HEAD_TEACHERS_ONLY"
  | "DIRECTION_ONLY"
  | "SPECIFIC_TARGETS";

const NON_SPECIFIC: AnnouncementAudience[] = [
  "ALL_STAFF",
  "CLASSROOM_TEACHERS",
  "HEAD_TEACHERS_ONLY",
  "DIRECTION_ONLY",
];

function isAnnouncementAudienceSubset(
  a: string | null | undefined,
): a is AnnouncementAudience {
  return (
    !!a &&
    (NON_SPECIFIC as readonly string[]).includes(a as AnnouncementAudience)
  );
}

/**
 * Qui voit un événement institutionnel (`personal = false`) ?
 */
export function userSeesSharedCalendarRow(
  user: SessionUser,
  row: RowLike,
  targets: CalendarEventTarget[],
  studentClassId: Map<string, string>,
): boolean {
  const aud = row.audience;
  if (!aud) return false;

  if (user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR") {
    return true;
  }

  // Lien ancien schéma : événement rattaché à un prof précis.
  if (row.teacher_id && row.teacher_id === user.id) {
    return true;
  }

  if (aud === "SPECIFIC_TARGETS") {
    for (const t of targets) {
      if (t.type === "profile" && t.id === user.id) return true;
      if (t.type === "class" && user.principalClassIds?.includes(t.id))
        return true;
      if (t.type === "student") {
        const cid = studentClassId.get(t.id);
        if (cid && user.principalClassIds?.includes(cid)) return true;
      }
    }
    return false;
  }

  if (isAnnouncementAudienceSubset(aud)) {
    return roleSeesAnnouncementAudience(user.role, aud);
  }

  return false;
}
