import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  PROFILE_SELECT_CORE,
  PROFILE_SELECT_SESSION,
  PROFILE_SELECT_SESSION_FULL,
  isMissingProfileColumnError,
} from "@/lib/supabase/profile-columns";
import { profileRoleToUserRole } from "@/lib/roles";
import type { SessionUser, TeacherEmploymentStatus } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type StudentSessionRow = {
  id: unknown;
  first_name: unknown;
  last_name: unknown;
  email: unknown;
  class_id: unknown;
  activated?: unknown;
};

async function fetchStudentRowForAuthUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudentSessionRow | null> {
  const attemptFull = await supabase
    .from("students")
    .select(
      "id,first_name,last_name,email,class_id,activated,auth_user_id,photo_url",
    )
    .eq("auth_user_id", userId)
    .maybeSingle();

  let row = attemptFull.data as StudentSessionRow | null;
  if (!attemptFull.error && row) return row;

  const slim = await supabase
    .from("students")
    .select("id,first_name,last_name,email,class_id,auth_user_id,photo_url")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!slim.error && slim.data) {
    return { ...(slim.data as StudentSessionRow), activated: undefined };
  }

  const admin = createAdminSupabase();
  if (!admin) return null;

  const attemptAdminFull = await admin
    .from("students")
    .select(
      "id,first_name,last_name,email,class_id,activated,auth_user_id,photo_url",
    )
    .eq("auth_user_id", userId)
    .maybeSingle();

  row = attemptAdminFull.data as StudentSessionRow | null;
  if (!attemptAdminFull.error && row) return row;

  const admSlim = await admin
    .from("students")
    .select("id,first_name,last_name,email,class_id,auth_user_id,photo_url")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!admSlim.error && admSlim.data) {
    return { ...(admSlim.data as StudentSessionRow), activated: undefined };
  }

  return null;
}

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

  if (!profileErr && profile) {
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

    const role = profileRoleToUserRole(String(profile.base_role));

    let session: SessionUser = {
      id: user.id,
      email: profile.email ?? user.email ?? "",
      firstName: profile.first_name,
      lastName: profile.last_name,
      role,
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

    if (role === "PROFESSEUR" || role === "PROF_PRINCIPAL") {
      let assignedClassIds: string[] = [];
      const { data: assignRow, error: assignErr } = await supabase
        .from("profiles")
        .select("assigned_class_ids")
        .eq("id", user.id)
        .maybeSingle();
      if (!assignErr && assignRow) {
        const raw = (assignRow as { assigned_class_ids?: unknown }).assigned_class_ids;
        if (Array.isArray(raw)) {
          assignedClassIds = raw.filter((id): id is string => typeof id === "string");
        }
      }
      session = { ...session, assignedClassIds };
    }

    if (role === "ELEVE") {
      const { data: linked } = await supabase
        .from("students")
        .select("id,class_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      session = {
        ...session,
        studentId: (linked?.id as string | undefined) ?? session.studentId,
        studentClassId:
          (linked?.class_id as string | null | undefined) ??
          session.studentClassId ??
          null,
      };
    }

    return session;
  }

  const stu = await fetchStudentRowForAuthUser(supabase, user.id);
  if (!stu) return null;

  const stActivated = (
    stu as { activated?: boolean | null }
  ).activated;
  if (stActivated === false) {
    await supabase.auth.signOut();
    return null;
  }

  const photoTrim = (
    ((stu as { photo_url?: string | null }).photo_url ?? "") as string
  ).trim();

  return {
    id: user.id,
    email: (stu.email as string | null) ?? user.email ?? "",
    firstName: String(stu.first_name ?? "").trim(),
    lastName: String(stu.last_name ?? "").trim(),
    role: "ELEVE",
    ...(photoTrim ? { avatarUrl: photoTrim } : {}),
    studentId: stu.id as string,
    studentClassId:
      ((stu.class_id as string | null | undefined) ?? null) || null,
  };
}
