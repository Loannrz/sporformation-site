import { createAdminSupabase } from "@/lib/supabase/admin";

export type ActivityLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export async function fetchActivityLogsForDirector(limit = 100) {
  const admin = createAdminSupabase();
  if (!admin) return { rows: [] as ActivityLogRow[], error: "NO_SERVICE" as const };

  const { data, error } = await admin
    .from("activity_logs")
    .select(
      "id, actor_id, action, entity_type, entity_id, meta, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [] as ActivityLogRow[], error: error.message };
  }
  return {
    rows: (data ?? []) as ActivityLogRow[],
    error: null as null,
  };
}
