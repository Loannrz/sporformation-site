import type { PostgrestError } from "@supabase/supabase-js";

/** Colonne `classes.description` absente tant que la migration 20260514 n’est pas appliquée. */
export function isMissingClassesDescriptionColumnError(
  err: PostgrestError | { message?: string; code?: string } | null,
): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return (
    err.code === "42703" ||
    (m.includes("description") &&
      (m.includes("does not exist") ||
        m.includes("schema cache") ||
        m.includes("could not find"))) ||
    (m.includes("column") && m.includes("classes") && m.includes("description"))
  );
}

/** Colonnes `academic_year_*` absentes tant que la migration 20260515 n’est pas appliquée. */
export function isMissingClassesAcademicYearColumnError(
  err: PostgrestError | { message?: string; code?: string } | null,
): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return (
    err.code === "42703" ||
    (m.includes("academic_year") &&
      (m.includes("does not exist") ||
        m.includes("schema cache") ||
        m.includes("could not find")))
  );
}
