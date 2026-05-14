/**
 * Champs « étendus » de la fiche élève alignés avec l'import Excel « Liste promo ».
 * Tous sont optionnels ; seuls first_name / last_name restent obligatoires.
 *
 * Cette source de vérité est utilisée à la fois côté serveur (sélections Supabase,
 * inserts) et côté client (formulaires) pour éviter la dérive.
 */

export const STUDENT_EXTENDED_COLUMNS = [
  "njs",
  "promo",
  "of_name",
  "formation_number",
  "diploma",
  "tep",
  "birth_country",
  "birth_department",
  "phone",
  "address_line1",
  "address_line2",
  "postal_code",
  "address_city",
  "address_country",
  "employment_status",
  "parcoursup",
  "validation_status",
  "uc1_status",
  "uc2_status",
  "uc3_status",
  "uc4_status",
] as const;

export type StudentExtendedColumn = (typeof STUDENT_EXTENDED_COLUMNS)[number];

export type StudentExtendedFields = Partial<
  Record<StudentExtendedColumn, string | null>
>;

/** Sélection complète à utiliser dans les requêtes Supabase. */
export const STUDENT_FULL_SELECT =
  "id,first_name,last_name,email,photo_url,class_id,entry_date,birth_date,sex,birth_place," +
  STUDENT_EXTENDED_COLUMNS.join(",");

/** Sélection sans les colonnes étendues (fallback si la migration n'est pas appliquée). */
export const STUDENT_BASE_SELECT =
  "id,first_name,last_name,email,photo_url,class_id,entry_date,birth_date,sex,birth_place";

/** Trim + null si vide. */
export function cleanExtendedValue(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

/** Map d'un objet partiel (clé snake_case) vers un patch nettoyé. */
export function buildExtendedPatch(
  input: Partial<Record<StudentExtendedColumn, string | null | undefined>>,
): StudentExtendedFields {
  const out: StudentExtendedFields = {};
  for (const k of STUDENT_EXTENDED_COLUMNS) {
    if (k in input) {
      out[k] = cleanExtendedValue(input[k]);
    }
  }
  return out;
}
