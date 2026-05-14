import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "@/types";

/** Périmètre lecture sanctions (hub + aperçu dashboard), aligné sur les rôles métier. */
export type SanctionsViewerScope =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "studentIds"; studentIds: string[] }
  | { kind: "authorOnly"; authorId: string };

export async function resolveSanctionsViewerScope(
  supabase: SupabaseClient,
  user: SessionUser,
): Promise<SanctionsViewerScope> {
  switch (user.role) {
    case "DIRECTEUR":
    case "ADMINISTRATEUR":
      return { kind: "all" };
    case "PROFESSEUR":
      return { kind: "authorOnly", authorId: user.id };
    case "PROF_PRINCIPAL": {
      const classIds = user.principalClassIds ?? [];
      if (classIds.length === 0) return { kind: "none" };
      const { data: studs } = await supabase
        .from("students")
        .select("id")
        .in("class_id", classIds);
      const studentIds = [
        ...new Set((studs ?? []).map((s) => (s as { id: string }).id)),
      ];
      if (studentIds.length === 0) return { kind: "none" };
      return { kind: "studentIds", studentIds };
    }
    case "ELEVE":
      if (!user.studentId) return { kind: "none" };
      return { kind: "studentIds", studentIds: [user.studentId] };
    default:
      return { kind: "none" };
  }
}
