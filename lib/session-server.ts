import { createServerSupabase } from "@/lib/supabase/server";
import {
  PROFILE_SELECT_CORE,
  PROFILE_SELECT_SESSION,
  PROFILE_SELECT_SESSION_FULL,
  isMissingProfileColumnError,
} from "@/lib/supabase/profile-columns";
import { profileRoleToUserRole } from "@/lib/roles";
import type { SessionUser, TeacherEmploymentStatus } from "@/types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  if (!supabase) return null;

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return null;

  let { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_SESSION_FULL)
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr && isMissingProfileColumnError(profileErr)) {
    ({ data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_SESSION)
      .eq("id", user.id)
      .maybeSingle());
  }

  if (profileErr && isMissingProfileColumnError(profileErr)) {
    ({ data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_CORE)
      .eq("id", user.id)
      .maybeSingle());
  }

  if (profileErr || !profile) return null;

  const activeAtEstablishment = (
    profile as { active_at_establishment?: boolean | null }
  ).active_at_establishment;

  if (activeAtEstablishment === false) {
    await supabase.auth.signOut();
    return null;
  }

  const extended = profile as typeof profile & {
    must_set_password?: boolean | null;
    teacher_employment_status?: string | null;
  };

  return {
    id: user.id,
    email: profile.email ?? user.email ?? "",
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: profileRoleToUserRole(String(profile.base_role)),
    avatarUrl: profile.avatar_url ?? undefined,
    bio: profile.bio ?? undefined,
    subjects: profile.subjects ?? undefined,
    joinedAt: profile.joined_at
      ? new Date(profile.joined_at as string).toISOString().slice(0, 10)
      : undefined,
    principalClassIds: (profile.principal_class_ids as string[] | null) ?? [],
    mustSetPassword: extended.must_set_password === true,
    teacherEmploymentStatus: extended.teacher_employment_status as
      | TeacherEmploymentStatus
      | undefined,
  };
}
