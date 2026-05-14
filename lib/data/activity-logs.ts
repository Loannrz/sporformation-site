import { createAdminSupabase } from "@/lib/supabase/admin";
import type { SessionUser } from "@/types";

export type ActivityLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type LogActivityInput = {
  actorId?: string | null;
  actorLabel?: string | null;
  actorRole?: string | null;
  action: ActivityAction;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  meta?: Record<string, unknown>;
};

export type ActivityAction =
  | "AUTH_SIGN_IN"
  | "AUTH_SIGN_IN_FIRST"
  | "AUTH_PASSWORD_CHANGED"
  | "AUTH_PASSWORD_FIRST_SET"
  | "FILE_UPLOADED"
  | "FILE_METADATA_UPDATED"
  | "FOLDER_CREATED"
  | "FOLDER_RENAMED"
  | "FOLDER_DELETED"
  | "FOLDER_TEMPLATE_APPLIED"
  | "STUDENT_INBOX_SUBFOLDER_CREATED"
  | "MESSAGE_SENT"
  | "MESSAGE_CONVERSATION_CREATED_DIRECT"
  | "MESSAGE_CONVERSATION_CREATED_GROUP"
  | "STAFF_CREATED"
  | "STAFF_UPDATED"
  | "STAFF_DELETED"
  | "STAFF_MARKED_LEFT"
  | "STAFF_REACTIVATED"
  | "STAFF_PENDING_INVITE_DELETED"
  | "STAFF_PASSWORD_RESET_BY_ADMIN"
  | "STUDENT_CREATED"
  | "STUDENT_UPDATED"
  | "STUDENT_DELETED"
  | "STUDENTS_BULK_DELETED"
  | "STUDENTS_IMPORTED"
  | "CLASS_CREATED"
  | "CLASS_UPDATED"
  | "CLASS_DELETED"
  | "ANNOUNCEMENT_CREATED"
  | "ANNOUNCEMENT_UPDATED"
  | "ANNOUNCEMENT_DELETED"
  | "SANCTION_CREATED"
  | "SANCTION_REPORTS_CREATED"
  | "SANCTION_UPDATED"
  | "SANCTION_RETIRED"
  | "SANCTION_DELETED"
  | "CALENDAR_PERSONAL_CREATED"
  | "CALENDAR_SCHOOL_CREATED"
  | "CALENDAR_EVENT_UPDATED"
  | "CALENDAR_EVENT_DELETED"
  | "PROFILE_UPDATED"
  | "PROFILE_AVATAR_UPDATED"
  | "TEACHER_SELF_SIGNUP";

export type ActivityCategory =
  | "auth"
  | "files"
  | "folders"
  | "messaging"
  | "accounts"
  | "students"
  | "classes"
  | "announcements"
  | "sanctions"
  | "calendar"
  | "profile";

const ACTION_CATEGORY: Record<ActivityAction, ActivityCategory> = {
  AUTH_SIGN_IN: "auth",
  AUTH_SIGN_IN_FIRST: "auth",
  AUTH_PASSWORD_CHANGED: "auth",
  AUTH_PASSWORD_FIRST_SET: "auth",
  FILE_UPLOADED: "files",
  FILE_METADATA_UPDATED: "files",
  FOLDER_CREATED: "folders",
  FOLDER_RENAMED: "folders",
  FOLDER_DELETED: "folders",
  FOLDER_TEMPLATE_APPLIED: "folders",
  STUDENT_INBOX_SUBFOLDER_CREATED: "folders",
  MESSAGE_SENT: "messaging",
  MESSAGE_CONVERSATION_CREATED_DIRECT: "messaging",
  MESSAGE_CONVERSATION_CREATED_GROUP: "messaging",
  STAFF_CREATED: "accounts",
  STAFF_UPDATED: "accounts",
  STAFF_DELETED: "accounts",
  STAFF_MARKED_LEFT: "accounts",
  STAFF_REACTIVATED: "accounts",
  STAFF_PENDING_INVITE_DELETED: "accounts",
  STAFF_PASSWORD_RESET_BY_ADMIN: "accounts",
  STUDENT_CREATED: "students",
  STUDENT_UPDATED: "students",
  STUDENT_DELETED: "students",
  STUDENTS_BULK_DELETED: "students",
  STUDENTS_IMPORTED: "students",
  CLASS_CREATED: "classes",
  CLASS_UPDATED: "classes",
  CLASS_DELETED: "classes",
  ANNOUNCEMENT_CREATED: "announcements",
  ANNOUNCEMENT_UPDATED: "announcements",
  ANNOUNCEMENT_DELETED: "announcements",
  SANCTION_CREATED: "sanctions",
  SANCTION_REPORTS_CREATED: "sanctions",
  SANCTION_UPDATED: "sanctions",
  SANCTION_RETIRED: "sanctions",
  SANCTION_DELETED: "sanctions",
  CALENDAR_PERSONAL_CREATED: "calendar",
  CALENDAR_SCHOOL_CREATED: "calendar",
  CALENDAR_EVENT_UPDATED: "calendar",
  CALENDAR_EVENT_DELETED: "calendar",
  PROFILE_UPDATED: "profile",
  PROFILE_AVATAR_UPDATED: "profile",
  TEACHER_SELF_SIGNUP: "accounts",
};

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  "auth",
  "files",
  "folders",
  "messaging",
  "accounts",
  "students",
  "classes",
  "announcements",
  "sanctions",
  "calendar",
  "profile",
];

export function categoryForAction(action: string): ActivityCategory {
  return ACTION_CATEGORY[action as ActivityAction] ?? "auth";
}

export function actorFromSession(
  user: Pick<SessionUser, "id" | "firstName" | "lastName" | "email" | "role"> | null,
): Pick<LogActivityInput, "actorId" | "actorLabel" | "actorRole"> {
  if (!user) return {};
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return {
    actorId: user.id,
    actorLabel: name || user.email || null,
    actorRole: user.role,
  };
}

/**
 * Inscrit une trace dans `activity_logs`. Ne lève jamais d'exception :
 * un échec d'écriture ne doit pas casser l'action métier appelante.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const admin = createAdminSupabase();
    if (!admin) return;
    const meta: Record<string, unknown> = { ...(input.meta ?? {}) };
    if (input.actorLabel) meta.actor_label = input.actorLabel;
    if (input.actorRole) meta.actor_role = input.actorRole;
    if (input.entityLabel) meta.entity_label = input.entityLabel;

    const insertRow = (actorId: string | null) =>
      admin.from("activity_logs").insert({
        actor_id: actorId,
        action: input.action,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        meta,
      });

    const { error } = await insertRow(input.actorId ?? null);

    // Fallback : si actor_id n'existe pas dans la table référencée par la FK
    // (cas typique : élève — auth.users.id sans profil dans public.profiles
    // tant que la migration 20260618 n'est pas appliquée), on conserve l'UID
    // dans meta et on insère avec actor_id = null pour ne rien perdre.
    if (error && (error as { code?: string }).code === "23503" && input.actorId) {
      meta.actor_auth_user_id = input.actorId;
      await insertRow(null);
    }
  } catch {
    // silent — logging never breaks user actions.
  }
}

export async function fetchActivityLogsForDirector(opts?: {
  limit?: number;
  category?: ActivityCategory | null;
  search?: string | null;
}) {
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);
  const admin = createAdminSupabase();
  if (!admin) return { rows: [] as ActivityLogRow[], error: "NO_SERVICE" as const };

  let q = admin
    .from("activity_logs")
    .select("id, actor_id, action, entity_type, entity_id, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.category) {
    const actions = (Object.entries(ACTION_CATEGORY) as [ActivityAction, ActivityCategory][])
      .filter(([, cat]) => cat === opts.category)
      .map(([action]) => action);
    if (actions.length) {
      q = q.in("action", actions);
    }
  }

  const { data, error } = await q;
  if (error) {
    return { rows: [] as ActivityLogRow[], error: error.message };
  }
  const rows = (data ?? []) as ActivityLogRow[];
  if (!opts?.search) {
    return { rows, error: null as null };
  }
  const needle = opts.search.toLowerCase();
  return {
    rows: rows.filter((r) => {
      const blob =
        `${r.action} ${r.entity_type ?? ""} ${r.entity_id ?? ""} ${JSON.stringify(
          r.meta ?? {},
        )}`.toLowerCase();
      return blob.includes(needle);
    }),
    error: null as null,
  };
}
