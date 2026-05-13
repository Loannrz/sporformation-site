import type { PostgrestError } from "@supabase/supabase-js";

/** Colonnes birth_date / sex / birth_place absentes tant que 20260516 n’est pas appliquée. */
export function isMissingStudentsIdentityColumnError(
  err: PostgrestError | { message?: string; code?: string } | null,
): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return (
    err.code === "42703" ||
    (m.includes("birth_date") &&
      (m.includes("does not exist") ||
        m.includes("schema cache") ||
        m.includes("could not find"))) ||
    (m.includes("birth_place") &&
      (m.includes("does not exist") ||
        m.includes("schema cache") ||
        m.includes("could not find"))) ||
    (m.includes("column") && m.includes("students") && m.includes("sex"))
  );
}
