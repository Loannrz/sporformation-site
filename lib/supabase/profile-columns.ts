import type { PostgrestError } from "@supabase/supabase-js";

/** Colonnes toujours présentes dans le schéma de base `profiles`. */
export const PROFILE_SELECT_CORE =
  "first_name,last_name,email,avatar_url,bio,joined_at,base_role,principal_class_ids,subjects" as const;

/** Colonnes ajoutées par la migration admin (départ établissement). */
export const PROFILE_SELECT_ESTABLISHMENT =
  "active_at_establishment,left_establishment_on" as const;

/** Onboarding enseignant (migration 20260214). */
export const PROFILE_SELECT_ONBOARDING =
  "must_set_password,teacher_employment_status" as const;

export const PROFILE_SELECT_SESSION = `${PROFILE_SELECT_CORE},${PROFILE_SELECT_ESTABLISHMENT}` as const;

export const PROFILE_SELECT_SESSION_FULL = `${PROFILE_SELECT_CORE},${PROFILE_SELECT_ESTABLISHMENT},${PROFILE_SELECT_ONBOARDING}` as const;

export function isMissingProfileColumnError(err: PostgrestError | null): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return (
    err.code === "42703" ||
    m.includes("does not exist") ||
    m.includes("active_at_establishment") ||
    m.includes("left_establishment_on") ||
    m.includes("must_set_password") ||
    m.includes("teacher_employment_status") ||
    m.includes("schema cache")
  );
}

/** Erreur PostgREST quand une colonne n’existe pas encore en base (migrations non appliquées). */
export function isProfilesExtendedColumnsUnavailable(err: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!err) return false;
  if (isMissingProfileColumnError(err as PostgrestError)) return true;
  const m = (err.message ?? "").toLowerCase();
  return (
    m.includes("schema cache") ||
    (m.includes("could not find") && m.includes("column")) ||
    err.code === "PGRST204"
  );
}
