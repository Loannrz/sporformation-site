"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  isMissingClassesAcademicYearColumnError,
  isMissingClassesDescriptionColumnError,
} from "@/lib/supabase/classes-columns";
import { ensureClassStudentInboxFolder } from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";
import { stripClassFromOtherProfiles } from "@/app/actions/staff-admin";
import { isDirector } from "@/lib/roles";
import type { SupabaseClient } from "@supabase/supabase-js";

const DOCUMENTS_BUCKET_DEFAULT = "documents";
const STORAGE_REMOVE_CHUNK = 100;

/** Supprime métadonnées + objets stockage pour tous les fichiers rattachés à la classe. */
async function deleteClassCloudFilesAndStorage(
  admin: SupabaseClient,
  classId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: files, error: fErr } = await admin
    .from("files")
    .select("id, bucket_id, current_path")
    .eq("class_id", classId);
  if (fErr) return { ok: false, error: fErr.message };

  const list = files ?? [];
  if (list.length === 0) return { ok: true };

  const ids = list.map((f) => String(f.id));
  const bucketByFileId = new Map<string, string>();
  const pathsByBucket = new Map<string, Set<string>>();

  const addPath = (
    bucketRaw: string | null | undefined,
    path: string | null | undefined,
  ) => {
    if (!path) return;
    const bucket = bucketRaw || DOCUMENTS_BUCKET_DEFAULT;
    let set = pathsByBucket.get(bucket);
    if (!set) {
      set = new Set();
      pathsByBucket.set(bucket, set);
    }
    set.add(path);
  };

  for (const f of list) {
    const id = String(f.id);
    const b = (f.bucket_id as string | null) ?? DOCUMENTS_BUCKET_DEFAULT;
    bucketByFileId.set(id, b);
    addPath(b, f.current_path as string | null | undefined);
  }

  const { data: vers, error: vErr } = await admin
    .from("file_versions")
    .select("file_id, storage_path")
    .in("file_id", ids);
  if (vErr) return { ok: false, error: vErr.message };
  for (const v of vers ?? []) {
    const fid = String(v.file_id);
    addPath(bucketByFileId.get(fid) ?? DOCUMENTS_BUCKET_DEFAULT, v.storage_path as string);
  }

  for (const [bucket, set] of pathsByBucket) {
    const paths = [...set];
    for (let i = 0; i < paths.length; i += STORAGE_REMOVE_CHUNK) {
      const slice = paths.slice(i, i + STORAGE_REMOVE_CHUNK);
      const { error: rmErr } = await admin.storage.from(bucket).remove(slice);
      if (rmErr) return { ok: false, error: rmErr.message };
    }
  }

  const { error: delErr } = await admin.from("files").delete().eq("class_id", classId);
  if (delErr) return { ok: false, error: delErr.message };
  return { ok: true };
}

async function requireDirector() {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const };
}

/** Met à jour prof principal pour une seule classe sans retirer les autres classes du titulaire. */
async function applyClassPrincipalChange(
  admin: SupabaseClient,
  classId: string,
  newPrincipalId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: cls, error: cErr } = await admin
    .from("classes")
    .select("principal_id")
    .eq("id", classId)
    .maybeSingle();
  if (cErr || !cls) return { ok: false, error: cErr?.message ?? "CLASS_NOT_FOUND" };

  const oldId = cls.principal_id as string | null;
  const now = new Date().toISOString();

  if (oldId && oldId !== newPrincipalId) {
    const { data: oldProf } = await admin
      .from("profiles")
      .select("principal_class_ids, base_role")
      .eq("id", oldId)
      .maybeSingle();
    const arr =
      (oldProf?.principal_class_ids as string[] | null)?.filter((x) => x !== classId) ??
      [];
    const updates: Record<string, unknown> = {
      principal_class_ids: arr,
      updated_at: now,
    };
    if (oldProf?.base_role === "PROF_PRINCIPAL" && arr.length === 0) {
      updates.base_role = "PROFESSEUR";
    }
    await admin.from("profiles").update(updates).eq("id", oldId);
  }

  if (!newPrincipalId) {
    const { error: uErr } = await admin
      .from("classes")
      .update({ principal_id: null })
      .eq("id", classId);
    if (uErr) return { ok: false, error: uErr.message };
    return { ok: true };
  }

  const { data: nu } = await admin
    .from("profiles")
    .select("base_role")
    .eq("id", newPrincipalId)
    .maybeSingle();
  const role = nu?.base_role as string | undefined;
  if (!role) return { ok: false, error: "PROFILE_NOT_FOUND" };
  if (role === "DIRECTEUR" || role === "ADMINISTRATEUR") {
    return { ok: false, error: "INVALID_PRINCIPAL" };
  }

  await stripClassFromOtherProfiles(admin, classId, newPrincipalId);

  const { data: newProf } = await admin
    .from("profiles")
    .select("principal_class_ids, base_role")
    .eq("id", newPrincipalId)
    .maybeSingle();
  if (!newProf) return { ok: false, error: "PROFILE_NOT_FOUND" };

  const merged = new Set([
    ...((newProf.principal_class_ids as string[] | null) ?? []),
    classId,
  ]);
  const profUpdate: Record<string, unknown> = {
    principal_class_ids: [...merged],
    updated_at: now,
  };
  if (newProf.base_role === "PROFESSEUR") {
    profUpdate.base_role = "PROF_PRINCIPAL";
  }
  const { error: pErr } = await admin
    .from("profiles")
    .update(profUpdate)
    .eq("id", newPrincipalId);
  if (pErr) return { ok: false, error: pErr.message };

  const { error: clErr } = await admin
    .from("classes")
    .update({ principal_id: newPrincipalId })
    .eq("id", classId);
  if (clErr) return { ok: false, error: clErr.message };

  return { ok: true };
}

function parseAcademicYears(input: {
  academicYearStart: number;
  academicYearEnd: number;
}): { ok: true; start: number; end: number } | { ok: false } {
  const start = Math.trunc(Number(input.academicYearStart));
  const end = Math.trunc(Number(input.academicYearEnd));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return { ok: false };
  }
  return { ok: true, start, end };
}

export async function createClassAction(
  locale: AppLocale,
  input: {
    name: string;
    description?: string | null;
    academicYearStart: number;
    academicYearEnd: number;
  },
) {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "NAME_REQUIRED" as const };

  const descTrim = input.description?.trim();
  const includeDesc = Boolean(descTrim);
  const yrs = parseAcademicYears(input);
  if (!yrs.ok) return { ok: false as const, error: "ACADEMIC_YEARS_INVALID" as const };

  let insertRow: Record<string, unknown> = {
    name,
    academic_year_start: yrs.start,
    academic_year_end: yrs.end,
  };
  if (includeDesc) insertRow.description = descTrim;

  let attempt = await admin.from("classes").insert(insertRow).select("id").single();

  while (attempt.error) {
    const e = attempt.error;
    if (
      isMissingClassesDescriptionColumnError(e) &&
      "description" in insertRow
    ) {
      const { description: _d, ...rest } = insertRow;
      insertRow = rest;
      attempt = await admin.from("classes").insert(insertRow).select("id").single();
      continue;
    }
    if (isMissingClassesAcademicYearColumnError(e)) {
      if ("academic_year_start" in insertRow) {
        const {
          academic_year_start: _as,
          academic_year_end: _ae,
          ...rest
        } = insertRow;
        insertRow = rest;
        attempt = await admin.from("classes").insert(insertRow).select("id").single();
        continue;
      }
    }
    break;
  }

  const { data, error } = attempt;
  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "INSERT_FAILED" };
  }

  await ensureClassStudentInboxFolder(admin, data.id as string);

  revalidatePath(`/${locale}/administration/classes`);
  revalidatePath(`/${locale}/administration/classes/${data.id}`);
  revalidatePath(`/${locale}/cloud`);
  return { ok: true as const, id: data.id };
}

export async function updateClassAction(
  locale: AppLocale,
  classId: string,
  input: {
    name: string;
    description?: string | null;
    principalId?: string | null;
    academicYearStart: number;
    academicYearEnd: number;
  },
) {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "NAME_REQUIRED" as const };

  const desc = input.description?.trim() || null;
  const yrs = parseAcademicYears(input);
  if (!yrs.ok) return { ok: false as const, error: "ACADEMIC_YEARS_INVALID" as const };

  let patch: Record<string, unknown> = {
    name,
    description: desc,
    academic_year_start: yrs.start,
    academic_year_end: yrs.end,
  };

  let upd = await admin.from("classes").update(patch).eq("id", classId);

  while (upd.error) {
    const e = upd.error;
    if (isMissingClassesDescriptionColumnError(e) && "description" in patch) {
      const { description: _d, ...rest } = patch;
      patch = rest;
      upd = await admin.from("classes").update(patch).eq("id", classId);
      continue;
    }
    if (isMissingClassesAcademicYearColumnError(e)) {
      if ("academic_year_start" in patch) {
        const {
          academic_year_start: _as,
          academic_year_end: _ae,
          ...rest
        } = patch;
        patch = rest;
        upd = await admin.from("classes").update(patch).eq("id", classId);
        continue;
      }
    }
    break;
  }

  if (upd.error) return { ok: false as const, error: upd.error.message };

  if (input.principalId !== undefined) {
    const pr = await applyClassPrincipalChange(admin, classId, input.principalId);
    if (!pr.ok) return { ok: false as const, error: pr.error };
  }

  revalidatePath(`/${locale}/administration/classes`);
  revalidatePath(`/${locale}/administration/classes/${classId}`);
  revalidatePath(`/${locale}/cloud`);
  return { ok: true as const };
}

export async function deleteClassAction(locale: AppLocale, classId: string) {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false as const, error: "NO_SERVICE_ROLE" as const };

  const { data: cls } = await admin
    .from("classes")
    .select("principal_id")
    .eq("id", classId)
    .maybeSingle();
  const pid = cls?.principal_id as string | null;
  if (pid) {
    const r = await applyClassPrincipalChange(admin, classId, null);
    if (!r.ok) return { ok: false as const, error: r.error };
  }

  const rmFiles = await deleteClassCloudFilesAndStorage(admin, classId);
  if (!rmFiles.ok) return { ok: false as const, error: rmFiles.error };

  const { error: dErr } = await admin.from("classes").delete().eq("id", classId);
  if (dErr) return { ok: false as const, error: dErr.message };

  revalidatePath(`/${locale}/administration/classes`);
  revalidatePath(`/${locale}/cloud`);
  return { ok: true as const };
}
