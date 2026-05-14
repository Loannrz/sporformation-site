import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `conversation_participants.profile_id` pointe vers `auth.users`.
 * Personnel : ligne `profiles` avec le même id. Élèves : fiche ou email Auth.
 */
export async function resolveEmailForAuthUserId(
  admin: SupabaseClient,
  authUserId: string,
): Promise<string | null> {
  const { data: prof } = await admin
    .from("profiles")
    .select("email")
    .eq("id", authUserId)
    .maybeSingle();
  const fromProf =
    typeof (prof as { email?: string } | null)?.email === "string"
      ? (prof as { email: string }).email.trim()
      : "";
  if (fromProf.includes("@")) return fromProf;

  const { data: student } = await admin
    .from("students")
    .select("email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  const fromStudent =
    typeof (student as { email?: string } | null)?.email === "string"
      ? (student as { email: string }).email.trim()
      : "";
  if (fromStudent.includes("@")) return fromStudent;

  try {
    const { data, error } = await admin.auth.admin.getUserById(authUserId);
    if (error || !data?.user?.email) return null;
    const e = data.user.email.trim();
    return e.includes("@") ? e : null;
  } catch {
    return null;
  }
}
