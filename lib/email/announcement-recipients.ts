import type { SupabaseClient } from "@supabase/supabase-js";
import { viewerSeesAnnouncement } from "@/lib/announcement-audience";
import { profileRoleToUserRole } from "@/lib/roles";
import type { AnnouncementAudience, UserRole } from "@/types";

/** Annonces = personnel uniquement (pas les comptes élèves dans le flux mails). */
function receivesAnnouncementAudience(
  role: UserRole,
  audience: AnnouncementAudience,
): boolean {
  if (role === "ELEVE") return false;
  return viewerSeesAnnouncement(role, audience);
}

/**
 * Liste d’emails uniques pour l’audience d’une annonce (colonnes présentes dans le schéma actuel).
 */
export async function fetchEmailsForAnnouncementAudience(
  admin: SupabaseClient,
  audience: AnnouncementAudience,
): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];

  const { data: rows, error } = await admin.from("profiles").select("email,base_role");

  if (error || !rows?.length) return out;

  for (const r of rows as { email?: string | null; base_role?: string | null }[]) {
    const email = typeof r.email === "string" ? r.email.trim() : "";
    if (!email.includes("@")) continue;
    const role = profileRoleToUserRole(String(r.base_role ?? "PROFESSEUR"));
    if (!receivesAnnouncementAudience(role, audience)) continue;
    const k = email.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(email);
  }

  return out;
}
