import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  PROFILE_SELECT_CORE,
  PROFILE_SELECT_ESTABLISHMENT,
  PROFILE_SELECT_ONBOARDING,
  PROFILE_SELECT_TEACHER_DOCS,
  isMissingProfileColumnError,
} from "@/lib/supabase/profile-columns";
import { profileRoleToUserRole } from "@/lib/roles";
import type { TeacherEmploymentStatus, UserRole } from "@/types";

const PROFILE_SELECT_ADMIN_EXTENDED =
  "first_name,last_name,email,avatar_url,bio,joined_at,base_role,principal_class_ids,assigned_class_ids,subjects" as const;

const ADMIN_LIST_WITH_ONBOARDING_EXT =
  `id,email,${PROFILE_SELECT_ADMIN_EXTENDED},${PROFILE_SELECT_ESTABLISHMENT},${PROFILE_SELECT_ONBOARDING},${PROFILE_SELECT_TEACHER_DOCS}` as const;
const ADMIN_LIST_MID_EXT =
  `id,email,${PROFILE_SELECT_ADMIN_EXTENDED},${PROFILE_SELECT_ESTABLISHMENT}` as const;
const ADMIN_LIST_CORE_EXT = `id,email,${PROFILE_SELECT_ADMIN_EXTENDED}` as const;

const ADMIN_LIST_WITH_ONBOARDING =
  `id,email,${PROFILE_SELECT_CORE},${PROFILE_SELECT_ESTABLISHMENT},${PROFILE_SELECT_ONBOARDING}` as const;
const ADMIN_LIST_MID =
  `id,email,${PROFILE_SELECT_CORE},${PROFILE_SELECT_ESTABLISHMENT}` as const;
const ADMIN_LIST_CORE = `id,email,${PROFILE_SELECT_CORE}` as const;

export type StaffAdminRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  bio: string | null;
  avatarUrl: string | null;
  subjects: string[] | null;
  joinedAt: string | null;
  principalClassIds: string[] | null;
  /** Classes où le professeur intervient (rôle PROFESSEUR uniquement en base). */
  assignedClassIds: string[];
  activeAtEstablishment: boolean;
  leftEstablishmentOn: string | null;
  mustSetPassword: boolean;
  teacherEmploymentStatus: TeacherEmploymentStatus | null;
  teacherDocumentsApprovedAt?: string | null;
};

function mapStaffRow(row: {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  base_role: string;
  bio: string | null;
  avatar_url: string | null;
  subjects: string[] | null;
  joined_at: string | null;
  principal_class_ids: string[] | null;
  assigned_class_ids?: string[] | null;
  active_at_establishment?: boolean | null;
  left_establishment_on?: string | null;
  must_set_password?: boolean | null;
  teacher_employment_status?: string | null;
  teacher_documents_approved_at?: string | null;
}): StaffAdminRow {
  return {
    id: row.id,
    email: row.email ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    role: profileRoleToUserRole(String(row.base_role)),
    bio: row.bio,
    avatarUrl: row.avatar_url,
    subjects: row.subjects,
    joinedAt: row.joined_at,
    principalClassIds: row.principal_class_ids,
    assignedClassIds: Array.isArray(row.assigned_class_ids)
      ? row.assigned_class_ids
      : [],
    activeAtEstablishment: row.active_at_establishment !== false,
    leftEstablishmentOn: row.left_establishment_on ?? null,
    mustSetPassword: row.must_set_password === true,
    teacherEmploymentStatus: (row.teacher_employment_status as TeacherEmploymentStatus) ?? null,
    ...(row.teacher_documents_approved_at !== undefined
      ? {
          teacherDocumentsApprovedAt: row.teacher_documents_approved_at,
        }
      : {}),
  };
}

async function selectAllStaff(supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>) {
  const r0 = await supabase
    .from("profiles")
    .select(ADMIN_LIST_WITH_ONBOARDING_EXT)
    .neq("base_role", "PEDAGO")
    .order("last_name", { ascending: true });

  if (!r0.error) return r0;
  if (!isMissingProfileColumnError(r0.error)) return r0;

  const r1 = await supabase
    .from("profiles")
    .select(ADMIN_LIST_WITH_ONBOARDING)
    .neq("base_role", "PEDAGO")
    .order("last_name", { ascending: true });

  if (!r1.error) return r1;
  if (!isMissingProfileColumnError(r1.error)) return r1;

  const r2 = await supabase
    .from("profiles")
    .select(ADMIN_LIST_MID)
    .neq("base_role", "PEDAGO")
    .order("last_name", { ascending: true });

  if (!r2.error) return r2;
  if (!isMissingProfileColumnError(r2.error)) return r2;

  return supabase
    .from("profiles")
    .select(ADMIN_LIST_CORE)
    .neq("base_role", "PEDAGO")
    .order("last_name", { ascending: true });
}

async function selectStaffById(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>,
  id: string,
) {
  const r0 = await supabase
    .from("profiles")
    .select(ADMIN_LIST_WITH_ONBOARDING_EXT)
    .eq("id", id)
    .maybeSingle();

  if (!r0.error) return r0;
  if (!isMissingProfileColumnError(r0.error)) return r0;

  const r1 = await supabase
    .from("profiles")
    .select(ADMIN_LIST_WITH_ONBOARDING)
    .eq("id", id)
    .maybeSingle();

  if (!r1.error) return r1;
  if (!isMissingProfileColumnError(r1.error)) return r1;

  const r2 = await supabase
    .from("profiles")
    .select(ADMIN_LIST_MID)
    .eq("id", id)
    .maybeSingle();

  if (!r2.error) return r2;
  if (!isMissingProfileColumnError(r2.error)) return r2;

  return supabase.from("profiles").select(ADMIN_LIST_CORE).eq("id", id).maybeSingle();
}

export async function fetchAllStaffForAdmin(): Promise<StaffAdminRow[]> {
  const admin = createAdminSupabase();
  if (admin) {
    const r0 = await admin
      .from("profiles")
      .select(ADMIN_LIST_WITH_ONBOARDING_EXT)
      .neq("base_role", "PEDAGO")
      .order("last_name", { ascending: true });
    if (!r0.error && r0.data) {
      return r0.data.map(mapStaffRow);
    }
    if (r0.error && isMissingProfileColumnError(r0.error)) {
      const r1 = await admin
        .from("profiles")
        .select(ADMIN_LIST_WITH_ONBOARDING)
        .neq("base_role", "PEDAGO")
        .order("last_name", { ascending: true });
      if (!r1.error && r1.data) {
        return r1.data.map(mapStaffRow);
      }
      if (r1.error && isMissingProfileColumnError(r1.error)) {
        const r2 = await admin
          .from("profiles")
          .select(ADMIN_LIST_MID)
          .neq("base_role", "PEDAGO")
          .order("last_name", { ascending: true });
        if (!r2.error && r2.data) {
          return r2.data.map(mapStaffRow);
        }
        if (r2.error && isMissingProfileColumnError(r2.error)) {
          const r3 = await admin
            .from("profiles")
            .select(ADMIN_LIST_CORE)
            .neq("base_role", "PEDAGO")
            .order("last_name", { ascending: true });
          if (!r3.error && r3.data) return r3.data.map(mapStaffRow);
        }
      }
    }
  }

  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const res = await selectAllStaff(supabase);
  if (res.error || !res.data) return [];
  return res.data.map(mapStaffRow);
}

/** Invitation sans compte Auth (table `teacher_pending_signups`). */
export type PendingTeacherInviteRow = {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  teacherEmploymentStatus: TeacherEmploymentStatus | null;
  principalClassIds: string[];
  assignedClassIds: string[];
  createdAt: string | null;
};

function isMissingPendingSignupAssignedColumnError(err: {
  code?: string | null;
  message?: string | null;
} | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "42703") return true;
  const m = (err.message ?? "").toLowerCase();
  return (
    m.includes("assigned_class_ids") &&
    (m.includes("does not exist") || m.includes("column"))
  );
}

export async function fetchPendingTeacherInvitesForAdmin(): Promise<
  PendingTeacherInviteRow[]
> {
  const admin = createAdminSupabase();
  if (!admin) return [];

  const fullSelect =
    "email,first_name,last_name,base_role,teacher_employment_status,principal_class_ids,assigned_class_ids,created_at" as const;
  const legacySelect =
    "email,first_name,last_name,base_role,teacher_employment_status,principal_class_ids,created_at" as const;

  let data: unknown[] | null = null;
  const res = await admin
    .from("teacher_pending_signups")
    .select(fullSelect)
    .order("created_at", { ascending: false });

  if (!res.error) {
    data = res.data;
  } else if (isMissingPendingSignupAssignedColumnError(res.error)) {
    const fallback = await admin
      .from("teacher_pending_signups")
      .select(legacySelect)
      .order("created_at", { ascending: false });
    if (fallback.error || !fallback.data?.length) return [];
    data = fallback.data;
  } else {
    return [];
  }

  if (!data?.length) return [];

  return (
    data as {
      email: string;
      first_name: string;
      last_name: string;
      base_role: string;
      teacher_employment_status: string | null;
      principal_class_ids: string[] | null;
      assigned_class_ids?: string[] | null;
      created_at: string | null;
    }[]
  ).map((row) => ({
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: profileRoleToUserRole(String(row.base_role)),
    teacherEmploymentStatus: (row.teacher_employment_status as TeacherEmploymentStatus) ?? null,
    principalClassIds: Array.isArray(row.principal_class_ids)
      ? row.principal_class_ids
      : [],
    assignedClassIds: Array.isArray(row.assigned_class_ids)
      ? row.assigned_class_ids
      : [],
    createdAt: row.created_at ?? null,
  }));
}

export async function fetchStaffByIdForAdmin(
  id: string,
): Promise<StaffAdminRow | null> {
  const admin = createAdminSupabase();
  if (admin) {
    const r0 = await admin
      .from("profiles")
      .select(ADMIN_LIST_WITH_ONBOARDING_EXT)
      .eq("id", id)
      .maybeSingle();
    if (!r0.error && r0.data) return mapStaffRow(r0.data);
    if (r0.error && isMissingProfileColumnError(r0.error)) {
      const r1 = await admin
        .from("profiles")
        .select(ADMIN_LIST_WITH_ONBOARDING)
        .eq("id", id)
        .maybeSingle();
      if (!r1.error && r1.data) return mapStaffRow(r1.data);
      if (r1.error && isMissingProfileColumnError(r1.error)) {
        const r2 = await admin
          .from("profiles")
          .select(ADMIN_LIST_MID)
          .eq("id", id)
          .maybeSingle();
        if (!r2.error && r2.data) return mapStaffRow(r2.data);
        if (r2.error && isMissingProfileColumnError(r2.error)) {
          const r3 = await admin
            .from("profiles")
            .select(ADMIN_LIST_CORE)
            .eq("id", id)
            .maybeSingle();
          if (!r3.error && r3.data) return mapStaffRow(r3.data);
        }
      }
    }
  }

  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const res = await selectStaffById(supabase, id);
  if (res.error || !res.data) return null;
  return mapStaffRow(res.data);
}
