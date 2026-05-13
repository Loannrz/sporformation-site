"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isMissingStudentsIdentityColumnError } from "@/lib/supabase/students-columns";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireStaffAdmin() {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const };
}

function normalizeSex(v: string | null | undefined): string | null {
  if (!v || v === "") return null;
  if (v === "M" || v === "F" || v === "X") return v;
  return null;
}

async function insertStudentWithFallback(
  admin: SupabaseClient,
  base: Record<string, unknown>,
) {
  let row = { ...base };
  let attempt = await admin.from("students").insert(row).select("id").single();
  while (attempt.error) {
    const e = attempt.error;
    if (isMissingStudentsIdentityColumnError(e)) {
      if ("birth_date" in row) {
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
    if (isMissingStudentsIdentityColumnError(e)) {
      if ("birth_date" in row) {
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
    }
    break;
  }
  return attempt;
}

export async function createStudentAction(
  locale: AppLocale,
  input: {
    firstName: string;
    lastName: string;
    email?: string | null;
    classId?: string | null;
    entryDate?: string | null;
    birthDate?: string | null;
    sex?: string | null;
    birthPlace?: string | null;
  },
) {
  const gate = await requireStaffAdmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false as const, error: "NAME_REQUIRED" as const };
  }

  const email = input.email?.trim() || null;
  const birthPlace = input.birthPlace?.trim() || null;
  const sex = normalizeSex(input.sex);
  const birthDate = input.birthDate?.trim() || null;
  const entryDate = input.entryDate?.trim() || null;
  const classId = input.classId?.trim() || null;

  const insertRow: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    email,
    class_id: classId || null,
    entry_date: entryDate || null,
    birth_date: birthDate || null,
    sex,
    birth_place: birthPlace || null,
  };

  const attempt = await insertStudentWithFallback(admin, insertRow);
  if (attempt.error || !attempt.data) {
    return {
      ok: false as const,
      error: attempt.error?.message ?? "INSERT_FAILED",
    };
  }

  const id = (attempt.data as { id: string }).id;
  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/students/${id}`);
  revalidatePath(`/${locale}/etudiants/${id}`);
  return { ok: true as const, id };
}

export async function updateStudentAction(
  locale: AppLocale,
  studentId: string,
  input: {
    firstName: string;
    lastName: string;
    email?: string | null;
    classId?: string | null;
    entryDate?: string | null;
    birthDate?: string | null;
    sex?: string | null;
    birthPlace?: string | null;
  },
) {
  const gate = await requireStaffAdmin();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false as const, error: "NAME_REQUIRED" as const };
  }

  const patch: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    email: input.email?.trim() || null,
    class_id: input.classId?.trim() || null,
    entry_date: input.entryDate?.trim() || null,
    birth_date: input.birthDate?.trim() || null,
    sex: normalizeSex(input.sex),
    birth_place: input.birthPlace?.trim() || null,
  };

  const attempt = await updateStudentWithFallback(admin, studentId, patch);
  if (attempt.error) {
    return { ok: false as const, error: attempt.error.message };
  }

  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/students/${studentId}`);
  revalidatePath(`/${locale}/etudiants/${studentId}`);
  return { ok: true as const };
}
