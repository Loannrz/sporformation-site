import type { PostgrestError } from "@supabase/supabase-js";
import { STUDENT_EXTENDED_COLUMNS } from "@/lib/students-extended-fields";

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

/**
 * Vrai si l’erreur correspond à une colonne « étendue » (njs, promo, …) absente.
 * Permet aux écritures de tomber en repli (drop des colonnes manquantes) tant que
 * la migration 20260616_students_extended_fields n’est pas appliquée.
 */
export function isMissingStudentsExtendedColumnError(
  err: PostgrestError | { message?: string; code?: string } | null,
): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  if (err.code !== "42703" && !m.includes("does not exist") &&
      !m.includes("schema cache") && !m.includes("could not find")) {
    return false;
  }
  return STUDENT_EXTENDED_COLUMNS.some((c) => m.includes(c));
}

/** Retourne le 1er nom de colonne « étendue » mentionnée dans l’erreur (sinon null). */
export function extractMissingExtendedColumnName(
  err: PostgrestError | { message?: string; code?: string } | null,
): string | null {
  if (!err) return null;
  const m = (err.message ?? "").toLowerCase();
  for (const c of STUDENT_EXTENDED_COLUMNS) {
    if (m.includes(c)) return c;
  }
  return null;
}
