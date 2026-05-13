import { createServerSupabase } from "@/lib/supabase/server";
import type { SessionUser, UserRole } from "@/types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(
      "first_name,last_name,email,avatar_url,bio,joined_at,base_role,principal_class_ids,subjects",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) return null;

  return {
    id: user.id,
    email: profile.email ?? user.email ?? "",
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: profile.base_role as UserRole,
    avatarUrl: profile.avatar_url ?? undefined,
    bio: profile.bio ?? undefined,
    subjects: profile.subjects ?? undefined,
    joinedAt: profile.joined_at
      ? new Date(profile.joined_at as string).toISOString().slice(0, 10)
      : undefined,
    principalClassIds: (profile.principal_class_ids as string[] | null) ?? [],
  };
}
