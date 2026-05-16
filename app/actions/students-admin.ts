"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  isMissingStudentsIdentityColumnError,
  isMissingStudentsExtendedColumnError,
  extractMissingExtendedColumnName,
} from "@/lib/supabase/students-columns";
import {
  STUDENT_EXTENDED_COLUMNS,
  buildExtendedPatch,
  cleanExtendedValue,
  type StudentExtendedColumn,
} from "@/lib/students-extended-fields";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { canAccessStudentAdministration } from "@/lib/pedago-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";

async function requireStudentAdministration() {
  const user = await getSessionUser();
  if (!user || !canAccessStudentAdministration(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

async function requireDirectorForDangerousStudentAction() {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

function normalizeSex(v: string | null | undefined): string | null {
  if (!v || v === "") return null;
  if (v === "M" || v === "F" || v === "X") return v;
  return null;
}

function stripExtendedColumns(
  row: Record<string, unknown>,
  cols: StudentExtendedColumn[],
): Record<string, unknown> {
  const out = { ...row };
  for (const c of cols) {
    if (c in out) delete out[c];
  }
  return out;
}

async function insertStudentWithFallback(
  admin: SupabaseClient,
  base: Record<string, unknown>,
) {
  let row = { ...base };
  let attempt = await admin.from("students").insert(row).select("id").single();
  while (attempt.error) {
    const e = attempt.error;
    if (isMissingStudentsIdentityColumnError(e) && "birth_date" in row) {
      const {
        birth_date: _bd,
        sex: _sx,
        birth_place: _bp,
        ...rest
      } = row as Record<string, unknown>;
      row = rest;
      attempt = await admin.from("students").insert(row).select("id").single();
      continue;
    }
    if (isMissingStudentsExtendedColumnError(e)) {
      const missing = extractMissingExtendedColumnName(e);
      if (missing) {
        row = stripExtendedColumns(row, [missing as StudentExtendedColumn]);
        attempt = await admin
          .from("students")
          .insert(row)
          .select("id")
          .single();
        continue;
      }
      // En dernier recours : tout dropper.
      row = stripExtendedColumns(row, [...STUDENT_EXTENDED_COLUMNS]);
      attempt = await admin
        .from("students")
        .insert(row)
        .select("id")
        .single();
      continue;
    }
    break;
  }
  return attempt;
}

async function updateStudentWithFallback(
  admin: SupabaseClient,
  studentId: string,
  patch: Record<string, unknown>,
) {
  let row = { ...patch };
  let attempt = await admin.from("students").update(row).eq("id", studentId);
  while (attempt.error) {
    const e = attempt.error;
    if (isMissingStudentsIdentityColumnError(e) && "birth_date" in row) {
      const {
        birth_date: _bd,
        sex: _sx,
        birth_place: _bp,
        ...rest
      } = row as Record<string, unknown>;
      row = rest;
      attempt = await admin.from("students").update(row).eq("id", studentId);
      continue;
    }
    if (isMissingStudentsExtendedColumnError(e)) {
      const missing = extractMissingExtendedColumnName(e);
      if (missing) {
        row = stripExtendedColumns(row, [missing as StudentExtendedColumn]);
        attempt = await admin
          .from("students")
          .update(row)
          .eq("id", studentId);
        continue;
      }
      row = stripExtendedColumns(row, [...STUDENT_EXTENDED_COLUMNS]);
      attempt = await admin
        .from("students")
        .update(row)
        .eq("id", studentId);
      continue;
    }
    break;
  }
  return attempt;
}

export type StudentBaseInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  classId?: string | null;
  entryDate?: string | null;
  birthDate?: string | null;
  sex?: string | null;
  birthPlace?: string | null;
};

export type StudentExtendedInput = Partial<
  Record<StudentExtendedColumn, string | null>
>;

export type StudentFullInput = StudentBaseInput & {
  extended?: StudentExtendedInput;
};

function buildStudentDbRow(input: StudentFullInput): Record<string, unknown> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const emailRaw = input.email?.trim();
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const base: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    email,
    class_id: input.classId?.trim() || null,
    entry_date: input.entryDate?.trim() || null,
    birth_date: input.birthDate?.trim() || null,
    sex: normalizeSex(input.sex),
    birth_place: cleanExtendedValue(input.birthPlace),
  };
  const ext = buildExtendedPatch(input.extended ?? {});
  return { ...base, ...ext };
}

export async function createStudentAction(
  locale: AppLocale,
  input: StudentFullInput,
) {
  const gate = await requireStudentAdministration();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false as const, error: "NAME_REQUIRED" as const };
  }

  const insertRow = buildStudentDbRow(input);

  const attempt = await insertStudentWithFallback(admin, insertRow);
  if (attempt.error || !attempt.data) {
    return {
      ok: false as const,
      error: attempt.error?.message ?? "INSERT_FAILED",
    };
  }

  const id = (attempt.data as { id: string }).id;

  await logActivity({
    ...actorFromSession(gate.user),
    action: "STUDENT_CREATED",
    entityType: "student",
    entityId: id,
    entityLabel: `${firstName} ${lastName}`.trim(),
    meta: {
      class_id: input.classId ?? null,
      email: input.email ?? null,
    },
  });

  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/students/${id}`);
  revalidatePath(`/${locale}/etudiants/${id}`);
  return { ok: true as const, id };
}

export async function updateStudentAction(
  locale: AppLocale,
  studentId: string,
  input: StudentFullInput,
) {
  const gate = await requireStudentAdministration();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false as const, error: "NAME_REQUIRED" as const };
  }

  const patch = buildStudentDbRow(input);

  const attempt = await updateStudentWithFallback(admin, studentId, patch);
  if (attempt.error) {
    return { ok: false as const, error: attempt.error.message };
  }

  await logActivity({
    ...actorFromSession(gate.user),
    action: "STUDENT_UPDATED",
    entityType: "student",
    entityId: studentId,
    entityLabel: `${firstName} ${lastName}`.trim(),
    meta: {
      class_id: input.classId ?? null,
    },
  });

  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/students/${studentId}`);
  revalidatePath(`/${locale}/etudiants/${studentId}`);
  return { ok: true as const };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BULK_DELETE_CHUNK = 120;

export type DeleteStudentsBulkResult =
  | {
      ok: true;
      deleted: number;
      /** Comptes Auth non supprimés après plusieurs tentatives (à vérifier dans Supabase). */
      authRemovalFailed?: number;
    }
  | {
      ok: false;
      error:
        | "FORBIDDEN"
        | "NO_SERVICE_ROLE"
        | "EMPTY_SELECTION"
        | "NOT_FOUND"
        | string;
    };

async function fetchAuthEmailToUserIdMap(
  admin: SupabaseClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      console.error("[purgeStudentRecords] listUsers:", error.message);
      break;
    }
    const users = data?.users ?? [];
    for (const u of users) {
      const em = (u.email ?? "").trim().toLowerCase();
      if (em && u.id) map.set(em, u.id);
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return map;
}

async function deleteAuthUserWithRetries(
  admin: SupabaseClient,
  uid: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (!error) return { ok: true };
    last = error.message;
    await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  console.error("[purgeStudentRecords] deleteUser définitif:", uid, last);
  return { ok: false, message: last };
}

function resolveAuthUserIdsForStudentRows(
  rows: Array<{ auth_user_id: string | null; email: string | null }>,
  emailMap: Map<string, string> | null,
): Set<string> {
  const ids = new Set<string>();
  for (const r of rows) {
    const direct = r.auth_user_id?.trim();
    if (direct) ids.add(direct);
    else if (r.email?.trim() && emailMap) {
      const uid = emailMap.get(r.email.trim().toLowerCase());
      if (uid) ids.add(uid);
    }
  }
  return ids;
}

async function purgeStudentRecords(
  admin: SupabaseClient,
  locale: AppLocale,
  rawIds: string[],
): Promise<DeleteStudentsBulkResult> {
  const unique = [
    ...new Set(rawIds.map((id) => id.trim()).filter((id) => UUID_RE.test(id))),
  ];
  if (unique.length === 0) {
    return { ok: false as const, error: "EMPTY_SELECTION" };
  }

  type Row = { id: string; auth_user_id: string | null; email: string | null };
  const list: Row[] = [];
  for (let i = 0; i < unique.length; i += BULK_DELETE_CHUNK) {
    const chunk = unique.slice(i, i + BULK_DELETE_CHUNK);
    const { data: rows, error: selErr } = await admin
      .from("students")
      .select("id, auth_user_id, email")
      .in("id", chunk);
    if (selErr) return { ok: false as const, error: selErr.message };
    for (const r of rows ?? []) {
      list.push({
        id: String((r as { id: string }).id),
        auth_user_id:
          ((r as { auth_user_id?: string | null }).auth_user_id as
            | string
            | null
            | undefined) ?? null,
        email:
          ((r as { email?: string | null }).email as string | null | undefined) ??
          null,
      });
    }
  }

  if (list.length === 0) {
    return { ok: false as const, error: "NOT_FOUND" };
  }

  const needsEmailLookup = list.some(
    (r) => !r.auth_user_id?.trim() && !!r.email?.trim(),
  );
  const emailMap = needsEmailLookup
    ? await fetchAuthEmailToUserIdMap(admin)
    : null;
  const authIds = resolveAuthUserIdsForStudentRows(list, emailMap);

  const idsToRemove = list.map((r) => r.id);

  for (let i = 0; i < idsToRemove.length; i += BULK_DELETE_CHUNK) {
    const chunk = idsToRemove.slice(i, i + BULK_DELETE_CHUNK);
    const { error: delErr } = await admin
      .from("students")
      .delete()
      .in("id", chunk);
    if (delErr) return { ok: false as const, error: delErr.message };
  }

  let authRemovalFailed = 0;
  for (const uid of authIds) {
    const att = await deleteAuthUserWithRetries(admin, uid);
    if (!att.ok) authRemovalFailed += 1;
  }

  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/classes`);
  for (const sid of idsToRemove) {
    revalidatePath(`/${locale}/admin/students/${sid}`);
    revalidatePath(`/${locale}/etudiants/${sid}`);
  }

  return {
    ok: true as const,
    deleted: idsToRemove.length,
    ...(authRemovalFailed > 0 ? { authRemovalFailed } : {}),
  };
}

/** Suppression multiple — réservée au directeur (comme suppression classe / enseignant). */
export async function deleteStudentsBulkAction(
  locale: AppLocale,
  studentIds: string[],
): Promise<DeleteStudentsBulkResult> {
  const gate = await requireDirectorForDangerousStudentAction();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" };

  const result = await purgeStudentRecords(admin, locale, studentIds);
  if (result.ok) {
    await logActivity({
      ...actorFromSession(gate.user),
      action: "STUDENTS_BULK_DELETED",
      entityType: "student",
      meta: {
        deleted_count: result.deleted,
        student_ids: studentIds,
      },
    });
  }
  return result;
}

/** Suppression d’un élève et de son compte Auth (directeur uniquement). */
export async function deleteStudentSingleAction(
  locale: AppLocale,
  studentId: string,
): Promise<DeleteStudentsBulkResult> {
  const gate = await requireDirectorForDangerousStudentAction();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" };

  const { data: snapshot } = await admin
    .from("students")
    .select("first_name,last_name")
    .eq("id", studentId)
    .maybeSingle();
  const snapLabel =
    `${(snapshot as { first_name?: string | null })?.first_name ?? ""} ${
      (snapshot as { last_name?: string | null })?.last_name ?? ""
    }`.trim() || null;

  const result = await purgeStudentRecords(admin, locale, [studentId]);
  if (result.ok) {
    await logActivity({
      ...actorFromSession(gate.user),
      action: "STUDENT_DELETED",
      entityType: "student",
      entityId: studentId,
      entityLabel: snapLabel,
    });
  }
  return result;
}
