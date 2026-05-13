"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isProfilesExtendedColumnsUnavailable } from "@/lib/supabase/profile-columns";
import { getSessionUser } from "@/lib/session-server";
import { canManageTeacherAccounts, isDirector } from "@/lib/roles";
import type { TeacherEmploymentStatus, UserRole } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePrincipalClassIds(
  raw: string[] | undefined | null,
): string[] {
  if (!raw?.length) return [];
  return [
    ...new Set(
      raw.map((x) => x.trim()).filter((x) => UUID_RE.test(x)),
    ),
  ];
}

async function ensurePrincipalClassAssignmentAllowed(
  admin: SupabaseClient,
  role: UserRole,
  classIds: string[],
): Promise<
  { ok: true } | { ok: false; error: "PRINCIPAL_CLASSES_REQUIRED" | "INVALID_PRINCIPAL_CLASSES" }
> {
  if (role !== "PROF_PRINCIPAL") return { ok: true };
  if (!classIds.length) return { ok: false, error: "PRINCIPAL_CLASSES_REQUIRED" };
  const { data, error } = await admin
    .from("classes")
    .select("id")
    .in("id", classIds);
  if (error) return { ok: false, error: "INVALID_PRINCIPAL_CLASSES" };
  if (!data || data.length !== classIds.length) {
    return { ok: false, error: "INVALID_PRINCIPAL_CLASSES" };
  }
  return { ok: true };
}

export async function stripClassFromOtherProfiles(
  admin: SupabaseClient,
  classId: string,
  exceptUserId: string,
) {
  const { data: rows, error } = await admin
    .from("profiles")
    .select("id, principal_class_ids")
    .contains("principal_class_ids", [classId]);
  if (error || !rows?.length) return;
  const now = new Date().toISOString();
  for (const row of rows) {
    if (row.id === exceptUserId) continue;
    const arr =
      (row.principal_class_ids as string[] | null)?.filter((x) => x !== classId) ??
      [];
    await admin
      .from("profiles")
      .update({ principal_class_ids: arr, updated_at: now })
      .eq("id", row.id);
  }
}

/** Met à jour `classes.principal_id` et retire le même `class_id` des autres profils PP. */
async function syncPrincipalClassAssignments(
  admin: SupabaseClient,
  teacherId: string,
  role: UserRole,
  classIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (role !== "PROF_PRINCIPAL") {
    const { error: cErr } = await admin
      .from("classes")
      .update({ principal_id: null })
      .eq("principal_id", teacherId);
    if (cErr) return { ok: false, error: cErr.message };
    return { ok: true };
  }

  const unique = [...new Set(classIds)];

  for (const cid of unique) {
    await stripClassFromOtherProfiles(admin, cid, teacherId);
  }

  const { error: clearErr } = await admin
    .from("classes")
    .update({ principal_id: null })
    .eq("principal_id", teacherId);
  if (clearErr) return { ok: false, error: clearErr.message };

  for (const cid of unique) {
    const { error: uErr } = await admin
      .from("classes")
      .update({ principal_id: teacherId })
      .eq("id", cid);
    if (uErr) return { ok: false, error: uErr.message };
  }

  return { ok: true };
}

async function requireDirector() {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

async function requireTeacherManager() {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

async function purgeTeacherFiles(admin: SupabaseClient, ownerId: string) {
  const { data: files, error: fErr } = await admin
    .from("files")
    .select("id, current_path, bucket_id")
    .eq("owner_id", ownerId);
  if (fErr || !files?.length) return;

  const fileIds = files.map((f) => f.id);
  const { data: versions } = await admin
    .from("file_versions")
    .select("storage_path")
    .in("file_id", fileIds);

  const byBucket = new Map<string, string[]>();
  const push = (bucket: string, path: string) => {
    if (!path) return;
    const b = bucket || "documents";
    const arr = byBucket.get(b) ?? [];
    arr.push(path);
    byBucket.set(b, arr);
  };

  for (const f of files) {
    if (f.current_path) push(f.bucket_id ?? "documents", f.current_path);
  }
  for (const v of versions ?? []) {
    if (v.storage_path) push("documents", v.storage_path);
  }

  for (const [bucket, paths] of byBucket) {
    const unique = [...new Set(paths)];
    if (unique.length) await admin.storage.from(bucket).remove(unique);
  }

  await admin.from("files").delete().in("id", fileIds);
}

function generateInternalOnlyPassword(): string {
  return `${randomBytes(28).toString("base64url")}Zz9!`;
}

function isAuthEmailTakenError(err: { message?: string } | null | undefined): boolean {
  if (!err?.message) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("user already exists") ||
    (m.includes("email") && m.includes("already"))
  );
}

async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const wanted = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find(
      (u) => (u.email ?? "").trim().toLowerCase() === wanted,
    );
    if (hit?.id) return hit.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

type TeacherProfileInsertInput = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  employmentStatus: TeacherEmploymentStatus;
  joinedAt?: string | null;
  leftEstablishmentOn?: string | null;
  bio?: string;
  subjectsCsv?: string;
  /** Classes dont cet enseignant est prof principal (si rôle PP). */
  principalClassIds: string[];
};

async function insertTeacherProfileRow(
  admin: SupabaseClient,
  input: TeacherProfileInsertInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const subjects = (input.subjectsCsv ?? "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const isFormer = input.employmentStatus === "FORMER_INACTIVE";
  const activeAt = !isFormer;
  const mustSet = !isFormer;
  const principalClassIdsForRow =
    input.role === "PROF_PRINCIPAL" ? input.principalClassIds : [];

  const profileRow: Record<string, unknown> = {
    id: input.id,
    email: input.email,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    base_role: input.role,
    bio: input.bio?.trim() || null,
    subjects: subjects.length ? subjects : [],
    joined_at: input.joinedAt?.trim() || null,
    active_at_establishment: activeAt,
    left_establishment_on: isFormer ? input.leftEstablishmentOn!.trim() : null,
    must_set_password: mustSet,
    teacher_employment_status: input.employmentStatus,
    principal_class_ids: principalClassIdsForRow,
  };

  const { error: pErr } = await admin.from("profiles").insert(profileRow);

  if (pErr && isProfilesExtendedColumnsUnavailable(pErr)) {
    const legacyRow: Record<string, unknown> = {
      id: input.id,
      email: input.email,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      base_role: input.role,
      bio: input.bio?.trim() || null,
      subjects: subjects.length ? subjects : [],
      joined_at: input.joinedAt?.trim() || null,
      principal_class_ids: principalClassIdsForRow,
    };
    const { error: legacyErr } = await admin.from("profiles").insert(legacyRow);
    if (legacyErr) return { ok: false, error: legacyErr.message };
    return { ok: true };
  }

  if (pErr) return { ok: false, error: pErr.message };
  return { ok: true };
}

export async function createTeacherAction(
  locale: AppLocale,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    employmentStatus: TeacherEmploymentStatus;
    /** YYYY-MM-DD — optionnel sauf sens métier (recommandé si actif / nouveau). */
    joinedAt?: string | null;
    /** Obligatoire si employmentStatus === FORMER_INACTIVE */
    leftEstablishmentOn?: string | null;
    bio?: string;
    subjectsCsv?: string;
    /** Obligatoire si role === PROF_PRINCIPAL — UUID des classes. */
    principalClassIds?: string[];
  },
) {
  const gate = await requireTeacherManager();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  if (input.role === "DIRECTEUR") {
    return { ok: false as const, error: "INVALID_ROLE" as const };
  }

  if (input.role === "ADMINISTRATEUR" && gate.user.role !== "DIRECTEUR") {
    return { ok: false as const, error: "INVALID_ROLE" as const };
  }

  if (
    gate.user.role === "ADMINISTRATEUR" &&
    input.role !== "PROFESSEUR" &&
    input.role !== "PROF_PRINCIPAL"
  ) {
    return { ok: false as const, error: "INVALID_ROLE" as const };
  }

  if (input.employmentStatus === "FORMER_INACTIVE") {
    if (!input.leftEstablishmentOn?.trim()) {
      return { ok: false as const, error: "LEFT_DATE_REQUIRED" as const };
    }
  }

  const fn = input.firstName.trim();
  const ln = input.lastName.trim();
  const emailRaw = input.email.trim().toLowerCase();
  if (!fn || !ln) {
    return { ok: false as const, error: "MISSING_REQUIRED_FIELDS" as const };
  }
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return { ok: false as const, error: "INVALID_EMAIL" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const normalizedPrincipal = normalizePrincipalClassIds(input.principalClassIds);
  const principalGate = await ensurePrincipalClassAssignmentAllowed(
    admin,
    input.role,
    normalizedPrincipal,
  );
  if (!principalGate.ok) {
    return { ok: false as const, error: principalGate.error };
  }

  const email = emailRaw;

  const isFormer = input.employmentStatus === "FORMER_INACTIVE";

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: generateInternalOnlyPassword(),
    email_confirm: true,
  });

  let id: string;

  if (created?.user?.id) {
    id = created.user.id;
  } else if (isAuthEmailTakenError(cErr)) {
    const existingId = await findAuthUserIdByEmail(admin, email);
    if (!existingId) {
      return { ok: false as const, error: "AUTH_USER_LOOKUP_FAILED" as const };
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", existingId)
      .maybeSingle();

    if (existingProfile) {
      return { ok: false as const, error: "EMAIL_ALREADY_IN_APP" as const };
    }

    id = existingId;
    const ins = await insertTeacherProfileRow(admin, {
      id,
      email,
      firstName: fn,
      lastName: ln,
      role: input.role,
      employmentStatus: input.employmentStatus,
      joinedAt: input.joinedAt,
      leftEstablishmentOn: input.leftEstablishmentOn,
      bio: input.bio,
      subjectsCsv: input.subjectsCsv,
      principalClassIds: normalizedPrincipal,
    });

    if (!ins.ok) {
      return { ok: false as const, error: ins.error };
    }

    const syncO = await syncPrincipalClassAssignments(
      admin,
      id,
      input.role,
      normalizedPrincipal,
    );
    if (!syncO.ok) {
      await admin.from("profiles").delete().eq("id", id);
      return { ok: false as const, error: syncO.error };
    }

    if (isFormer) {
      await admin.auth.admin.updateUserById(id, { ban_duration: "800000h" });
    }

    revalidatePath(`/${locale}/administration/comptes`);
    return { ok: true as const, id, linkedExistingAuth: true as const };
  } else {
    return {
      ok: false as const,
      error: cErr?.message ?? "AUTH_CREATE_FAILED",
    };
  }

  const ins = await insertTeacherProfileRow(admin, {
    id,
    email,
    firstName: fn,
    lastName: ln,
    role: input.role,
    employmentStatus: input.employmentStatus,
    joinedAt: input.joinedAt,
    leftEstablishmentOn: input.leftEstablishmentOn,
    bio: input.bio,
    subjectsCsv: input.subjectsCsv,
    principalClassIds: normalizedPrincipal,
  });

  if (!ins.ok) {
    await admin.auth.admin.deleteUser(id);
    return { ok: false as const, error: ins.error };
  }

  const syncN = await syncPrincipalClassAssignments(
    admin,
    id,
    input.role,
    normalizedPrincipal,
  );
  if (!syncN.ok) {
    await admin.from("profiles").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
    return { ok: false as const, error: syncN.error };
  }

  if (isFormer) {
    await admin.auth.admin.updateUserById(id, { ban_duration: "800000h" });
  }

  revalidatePath(`/${locale}/administration/comptes`);
  return { ok: true as const, id };
}

export async function updateTeacherProfileAction(
  locale: AppLocale,
  teacherId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    bio: string;
    role: UserRole;
    subjectsCsv: string;
    /** Renseigné lorsque role === PROF_PRINCIPAL (directeur). */
    principalClassIds?: string[];
  },
) {
  const gate = await requireTeacherManager();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const { data: target } = await admin
    .from("profiles")
    .select("base_role")
    .eq("id", teacherId)
    .maybeSingle();
  const targetRole = target?.base_role as UserRole | undefined;

  if (gate.user.role === "ADMINISTRATEUR") {
    if (targetRole === "DIRECTEUR" || targetRole === "ADMINISTRATEUR") {
      return { ok: false as const, error: "FORBIDDEN" as const };
    }
    if (targetRole !== "PROFESSEUR" && targetRole !== "PROF_PRINCIPAL") {
      return { ok: false as const, error: "FORBIDDEN" as const };
    }
    if (input.role !== "PROFESSEUR" && input.role !== "PROF_PRINCIPAL") {
      return { ok: false as const, error: "INVALID_ROLE" as const };
    }
  }

  if (input.role === "DIRECTEUR" && teacherId !== gate.user.id) {
    return { ok: false as const, error: "CANT_PROMOTE_DIRECTOR" as const };
  }
  if (
    isDirector(gate.user) &&
    teacherId === gate.user.id &&
    input.role !== "DIRECTEUR"
  ) {
    return { ok: false as const, error: "DEMOTE_SELF" as const };
  }

  const email = input.email.trim();
  const subjects = input.subjectsCsv
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const normalizedPrincipal = normalizePrincipalClassIds(input.principalClassIds ?? []);
  const principalGate = await ensurePrincipalClassAssignmentAllowed(
    admin,
    input.role,
    normalizedPrincipal,
  );
  if (!principalGate.ok) {
    return { ok: false as const, error: principalGate.error };
  }

  const principalForProfile =
    input.role === "PROF_PRINCIPAL" ? normalizedPrincipal : [];

  const { error: pErr } = await admin
    .from("profiles")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: email.length ? email : null,
      bio: input.bio.trim() || null,
      base_role: input.role,
      subjects: subjects.length ? subjects : [],
      principal_class_ids: principalForProfile,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teacherId);

  if (pErr) return { ok: false as const, error: pErr.message };

  const syncU = await syncPrincipalClassAssignments(
    admin,
    teacherId,
    input.role,
    principalForProfile,
  );
  if (!syncU.ok) return { ok: false as const, error: syncU.error };

  const { error: aErr } = await admin.auth.admin.updateUserById(teacherId, {
    ...(email.length ? { email } : {}),
  });
  if (aErr) return { ok: false as const, error: aErr.message };

  revalidatePath(`/${locale}/administration/comptes`);
  revalidatePath(`/${locale}/administration/comptes/${teacherId}`);
  revalidatePath(`/${locale}/profil/${teacherId}`);
  return { ok: true as const };
}

export async function resetTeacherPasswordAction(
  locale: AppLocale,
  teacherId: string,
  newPassword: string,
) {
  const gate = await requireTeacherManager();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  if (gate.user.role === "ADMINISTRATEUR") {
    const { data: target } = await admin
      .from("profiles")
      .select("base_role")
      .eq("id", teacherId)
      .maybeSingle();
    const tr = target?.base_role as UserRole | undefined;
    if (tr === "DIRECTEUR" || tr === "ADMINISTRATEUR") {
      return { ok: false as const, error: "FORBIDDEN" as const };
    }
  }

  const { error } = await admin.auth.admin.updateUserById(teacherId, {
    password: newPassword,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/${locale}/administration/comptes/${teacherId}`);
  return { ok: true as const };
}

export async function markTeacherLeftEstablishmentAction(
  locale: AppLocale,
  teacherId: string,
  leftOn: string,
) {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  if (gate.user.id === teacherId) {
    return { ok: false as const, error: "NO_SELF" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const { error: pErr } = await admin
    .from("profiles")
    .update({
      active_at_establishment: false,
      left_establishment_on: leftOn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teacherId);

  if (pErr) return { ok: false as const, error: pErr.message };

  const { error: bErr } = await admin.auth.admin.updateUserById(teacherId, {
    ban_duration: "800000h",
  });
  if (bErr) return { ok: false as const, error: bErr.message };

  revalidatePath(`/${locale}/administration/comptes`);
  revalidatePath(`/${locale}/administration/comptes/${teacherId}`);
  revalidatePath(`/${locale}/profil/${teacherId}`);
  return { ok: true as const };
}

export async function reactivateTeacherEstablishmentAction(
  locale: AppLocale,
  teacherId: string,
) {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const { error: pErr } = await admin
    .from("profiles")
    .update({
      active_at_establishment: true,
      left_establishment_on: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", teacherId);

  if (pErr) return { ok: false as const, error: pErr.message };

  const { error: bErr } = await admin.auth.admin.updateUserById(teacherId, {
    ban_duration: "none",
  });
  if (bErr) return { ok: false as const, error: bErr.message };

  revalidatePath(`/${locale}/administration/comptes`);
  revalidatePath(`/${locale}/administration/comptes/${teacherId}`);
  revalidatePath(`/${locale}/profil/${teacherId}`);
  return { ok: true as const };
}

export async function deleteTeacherAndDocumentsAction(
  locale: AppLocale,
  teacherId: string,
) {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  if (gate.user.id === teacherId) {
    return { ok: false as const, error: "NO_SELF" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const { data: victim } = await admin
    .from("profiles")
    .select("base_role")
    .eq("id", teacherId)
    .maybeSingle();
  if (victim?.base_role === "DIRECTEUR") {
    return { ok: false as const, error: "NO_DELETE_DIRECTOR" as const };
  }

  await purgeTeacherFiles(admin, teacherId);

  const { error: dErr } = await admin.auth.admin.deleteUser(teacherId);
  if (dErr) return { ok: false as const, error: dErr.message };

  revalidatePath(`/${locale}/administration/comptes`);
  revalidatePath(`/${locale}/administration/comptes/${teacherId}`);
  revalidatePath(`/${locale}/profil/${teacherId}`);
  return { ok: true as const };
}
