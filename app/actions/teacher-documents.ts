"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import {
  canManageTeacherAccounts,
  isDirector,
  isStaffAdmin,
} from "@/lib/roles";
import { sanitizeStorageObjectFileName } from "@/lib/storage-filename";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchTeacherDocumentRequestsForProfile,
  fetchTeacherDocumentTemplates,
} from "@/lib/data/teacher-documents";

const BUCKET = "documents";
const MAX_BYTES = 50 * 1024 * 1024;

async function deleteFileCascade(admin: SupabaseClient, fileId: string) {
  const { data: file } = await admin
    .from("files")
    .select("id, current_path, bucket_id")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return;

  const { data: versions } = await admin
    .from("file_versions")
    .select("storage_path")
    .eq("file_id", fileId);

  const byBucket = new Map<string, string[]>();
  const push = (bucket: string, path: string) => {
    if (!path) return;
    const b = bucket || BUCKET;
    const arr = byBucket.get(b) ?? [];
    arr.push(path);
    byBucket.set(b, arr);
  };

  if (file.current_path) {
    push((file.bucket_id as string) ?? BUCKET, file.current_path as string);
  }
  for (const v of versions ?? []) {
    if (v.storage_path) push(BUCKET, v.storage_path as string);
  }

  for (const [bucket, paths] of byBucket) {
    const unique = [...new Set(paths)];
    if (unique.length) await admin.storage.from(bucket).remove(unique);
  }

  await admin.from("files").delete().eq("id", fileId);
}

export async function uploadTeacherDocumentRequestAction(
  locale: AppLocale,
  formData: FormData,
): Promise<
  | { ok: true }
  | {
      ok: false;
      error:
        | "UNAUTH"
        | "NO_SERVICE"
        | "FORBIDDEN"
        | "FILE_REQUIRED"
        | "FILE_TOO_LARGE"
        | "INVALID_REQUEST"
        | "UPLOAD_FAILED";
      detail?: string;
    }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) return { ok: false, error: "INVALID_REQUEST" };

  const { data: row, error: rErr } = await admin
    .from("teacher_document_requests")
    .select("id, teacher_profile_id, file_id")
    .eq("id", requestId)
    .maybeSingle();

  if (rErr || !row || row.teacher_profile_id !== user.id) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("teacher_documents_approved_at")
    .eq("id", user.id)
    .maybeSingle();
  if (prof?.teacher_documents_approved_at) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "FILE_REQUIRED" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }

  const oldFileId = row.file_id as string | null;
  const safeName = sanitizeStorageObjectFileName(file.name);
  const fileId = randomUUID();
  const storagePath = `teacher-docs/${requestId}/v1/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) {
    return { ok: false, error: "UPLOAD_FAILED", detail: upErr.message };
  }

  const documentLabel = safeName;

  const insRow: Record<string, unknown> = {
    id: fileId,
    logical_key: `teacher-doc-${requestId}`,
    bucket_id: BUCKET,
    current_path: storagePath,
    class_id: null,
    owner_id: user.id,
    student_id: null,
    mime: file.type || null,
    title: documentLabel,
    description: "",
    cloud_audience: "STAFF",
  };

  const { error: insErr } = await admin.from("files").insert(insRow);
  if (insErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: "UPLOAD_FAILED", detail: insErr.message };
  }

  const { error: vErr } = await admin.from("file_versions").insert({
    file_id: fileId,
    storage_path: storagePath,
    version: 1,
    uploaded_by: user.id,
  });
  if (vErr) {
    await admin.from("files").delete().eq("id", fileId);
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { ok: false, error: "UPLOAD_FAILED", detail: vErr.message };
  }

  const { error: uReqErr } = await admin
    .from("teacher_document_requests")
    .update({ file_id: fileId })
    .eq("id", requestId)
    .eq("teacher_profile_id", user.id);

  if (uReqErr) {
    await deleteFileCascade(admin, fileId);
    return { ok: false, error: "UPLOAD_FAILED", detail: uReqErr.message };
  }

  if (oldFileId) {
    await deleteFileCascade(admin, oldFileId);
  }

  await admin
    .from("profiles")
    .update({ teacher_documents_bundle_submitted_at: null })
    .eq("id", user.id);

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_ONBOARDING_DOC_UPLOADED",
    entityType: "teacher_document_request",
    entityId: requestId,
    entityLabel: documentLabel,
    meta: { file_id: fileId },
  });

  revalidatePath(`/${locale}/documents-a-fournir`);
  revalidatePath(`/${locale}/cloud`);
  return { ok: true };
}

export async function submitTeacherDocumentsBundleAction(locale: AppLocale): Promise<
  | { ok: true }
  | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "INCOMPLETE" | "NO_SERVICE" }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const requests = await fetchTeacherDocumentRequestsForProfile(admin, user.id);
  if (!requests.length) return { ok: false, error: "FORBIDDEN" };

  const { data: prof } = await admin
    .from("profiles")
    .select(
      "teacher_employment_status, teacher_documents_approved_at, teacher_documents_bundle_submitted_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!prof || prof.teacher_documents_approved_at) {
    return { ok: false, error: "FORBIDDEN" };
  }

  if (prof.teacher_employment_status !== "NEW_TO_SCHOOL") {
    return { ok: false, error: "FORBIDDEN" };
  }

  const allFilled = requests.every((r) => r.file_id != null);
  if (!allFilled) return { ok: false, error: "INCOMPLETE" };

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("profiles")
    .update({ teacher_documents_bundle_submitted_at: nowIso })
    .eq("id", user.id);

  if (error) return { ok: false, error: "NO_SERVICE" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_ONBOARDING_BUNDLE_SUBMITTED",
    entityType: "profile",
    entityId: user.id,
    meta: { request_count: requests.length },
  });

  revalidatePath(`/${locale}/documents-a-fournir`);
  revalidatePath(`/${locale}/admin/teacher-documents`);
  return { ok: true };
}

export async function upsertTeacherDocumentTemplateAction(
  locale: AppLocale,
  input: {
    id?: string | null;
    label: string;
    description?: string | null;
    sortOrder: number;
    active: boolean;
    appliesToNewTeachers: boolean;
  },
): Promise<
  { ok: true; id: string } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" }
> {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const label = input.label.trim();
  if (!label) return { ok: false, error: "FORBIDDEN" };

  const now = new Date().toISOString();
  const payload = {
    label,
    description: input.description?.trim() || null,
    sort_order: input.sortOrder,
    active: input.active,
    applies_to_new_teachers: input.appliesToNewTeachers,
    updated_at: now,
  };

  if (input.id) {
    const { error } = await admin
      .from("teacher_document_templates")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false, error: "NO_SERVICE" };
    revalidatePath(`/${locale}/admin/teacher-documents`);
    return { ok: true, id: input.id };
  }

  const { data: ins, error: insErr } = await admin
    .from("teacher_document_templates")
    .insert({ ...payload, created_at: now })
    .select("id")
    .single();

  if (insErr || !ins) return { ok: false, error: "NO_SERVICE" };
  revalidatePath(`/${locale}/admin/teacher-documents`);
  return { ok: true, id: ins.id as string };
}

export async function deleteTeacherDocumentTemplateAction(
  locale: AppLocale,
  templateId: string,
): Promise<{ ok: true } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" }> {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { error } = await admin
    .from("teacher_document_templates")
    .delete()
    .eq("id", templateId);
  if (error) return { ok: false, error: "NO_SERVICE" };
  revalidatePath(`/${locale}/admin/teacher-documents`);
  return { ok: true };
}

export async function addTeacherDocumentRequestAction(
  locale: AppLocale,
  input: {
    teacherProfileId: string;
    templateId?: string | null;
    customLabel?: string | null;
  },
): Promise<
  { ok: true } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" | "INVALID" }
> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { data: teacher } = await admin
    .from("profiles")
    .select("id, base_role, teacher_documents_approved_at")
    .eq("id", input.teacherProfileId)
    .maybeSingle();

  if (
    !teacher ||
    (teacher.base_role !== "PROFESSEUR" && teacher.base_role !== "PROF_PRINCIPAL")
  ) {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (teacher.teacher_documents_approved_at) {
    return { ok: false, error: "FORBIDDEN" };
  }

  let label = (input.customLabel ?? "").trim();
  let description: string | null = null;
  let templateId: string | null = null;
  let sortOrder = 0;

  if (input.templateId) {
    const { data: tpl } = await admin
      .from("teacher_document_templates")
      .select("id, label, description, sort_order")
      .eq("id", input.templateId)
      .maybeSingle();
    if (!tpl) return { ok: false, error: "INVALID" };
    label = String(tpl.label);
    description = (tpl.description as string | null) ?? null;
    templateId = tpl.id as string;
    sortOrder = (tpl.sort_order as number) ?? 0;
  }

  if (!label) return { ok: false, error: "INVALID" };

  const { data: existing } = await admin
    .from("teacher_document_requests")
    .select("sort_order")
    .eq("teacher_profile_id", input.teacherProfileId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder =
    existing?.sort_order != null ? (existing.sort_order as number) + 1 : sortOrder;

  const { error } = await admin.from("teacher_document_requests").insert({
    teacher_profile_id: input.teacherProfileId,
    template_id: templateId,
    label,
    description,
    sort_order: nextOrder,
  });
  if (error) return { ok: false, error: "NO_SERVICE" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_DOC_REQUEST_ADDED",
    entityType: "profile",
    entityId: input.teacherProfileId,
    meta: { template_id: templateId, label },
  });

  revalidatePath(`/${locale}/administration/comptes/${input.teacherProfileId}`);
  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/documents-a-fournir`);
  return { ok: true };
}

export async function removeTeacherDocumentRequestAction(
  locale: AppLocale,
  requestId: string,
  teacherProfileId: string,
): Promise<
  { ok: true } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" }
> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { data: row } = await admin
    .from("teacher_document_requests")
    .select("id, file_id, teacher_profile_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!row || row.teacher_profile_id !== teacherProfileId) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const fid = row.file_id as string | null;
  const { error: delErr } = await admin
    .from("teacher_document_requests")
    .delete()
    .eq("id", requestId);
  if (delErr) return { ok: false, error: "NO_SERVICE" };

  if (fid) await deleteFileCascade(admin, fid);

  await admin
    .from("profiles")
    .update({ teacher_documents_bundle_submitted_at: null })
    .eq("id", teacherProfileId);

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_DOC_REQUEST_REMOVED",
    entityType: "teacher_document_request",
    entityId: requestId,
    meta: { teacher_profile_id: teacherProfileId },
  });

  revalidatePath(`/${locale}/administration/comptes/${teacherProfileId}`);
  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/documents-a-fournir`);
  return { ok: true };
}

export async function approveTeacherDocumentsAccessAction(
  locale: AppLocale,
  teacherProfileId: string,
): Promise<
  { ok: true } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" }
> {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const now = new Date().toISOString();
  const { data: updatedRows, error } = await admin
    .from("profiles")
    .update({
      teacher_documents_approved_at: now,
      teacher_documents_approved_by: user.id,
      teacher_employment_status: "ACTIVE_AT_SCHOOL",
    })
    .eq("id", teacherProfileId)
    .in("base_role", ["PROFESSEUR", "PROF_PRINCIPAL"])
    .select("id");

  if (error) return { ok: false, error: "NO_SERVICE" };
  if (!updatedRows?.length) return { ok: false, error: "FORBIDDEN" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_ONBOARDING_APPROVED",
    entityType: "profile",
    entityId: teacherProfileId,
  });

  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/administration/comptes/${teacherProfileId}`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/cloud`);
  return { ok: true };
}

export async function revokeTeacherDocumentsApprovalAction(
  locale: AppLocale,
  teacherProfileId: string,
): Promise<
  { ok: true } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" }
> {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { data: updatedRows, error } = await admin
    .from("profiles")
    .update({
      teacher_documents_approved_at: null,
      teacher_documents_approved_by: null,
      teacher_employment_status: "NEW_TO_SCHOOL",
    })
    .eq("id", teacherProfileId)
    .in("base_role", ["PROFESSEUR", "PROF_PRINCIPAL"])
    .select("id");

  if (error) return { ok: false, error: "NO_SERVICE" };
  if (!updatedRows?.length) return { ok: false, error: "FORBIDDEN" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_ONBOARDING_APPROVAL_REVOKED",
    entityType: "profile",
    entityId: teacherProfileId,
  });

  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/administration/comptes/${teacherProfileId}`);
  return { ok: true };
}

export async function resetTeacherDocumentsBundleAction(
  locale: AppLocale,
  teacherProfileId: string,
): Promise<
  { ok: true } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" }
> {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { error } = await admin
    .from("profiles")
    .update({ teacher_documents_bundle_submitted_at: null })
    .eq("id", teacherProfileId);

  if (error) return { ok: false, error: "NO_SERVICE" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_ONBOARDING_BUNDLE_RESET",
    entityType: "profile",
    entityId: teacherProfileId,
  });

  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/administration/comptes/${teacherProfileId}`);
  revalidatePath(`/${locale}/documents-a-fournir`);
  return { ok: true };
}

export async function seedDefaultTeacherDocumentTemplatesAction(locale: AppLocale): Promise<
  { ok: true; inserted: number } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const existing = await fetchTeacherDocumentTemplates(admin);
  if (existing.length > 0) return { ok: true, inserted: 0 };

  const now = new Date().toISOString();
  const seeds = [
    {
      label: "Pièce d'identité",
      description: "CNI ou passeport en cours de validité",
      sort_order: 0,
      applies_to_new_teachers: true,
      active: true,
      created_at: now,
      updated_at: now,
    },
    {
      label: "Diplôme ou titre requis",
      description: "Copie du diplôme le plus élevé pertinent pour la fonction",
      sort_order: 1,
      applies_to_new_teachers: true,
      active: true,
      created_at: now,
      updated_at: now,
    },
    {
      label: "Casier judiciaire / attestation (si applicable)",
      description: "Document suivant la réglementation de l'établissement",
      sort_order: 2,
      applies_to_new_teachers: true,
      active: true,
      created_at: now,
      updated_at: now,
    },
  ];

  const { data, error } = await admin
    .from("teacher_document_templates")
    .insert(seeds)
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/${locale}/admin/teacher-documents`);
  return { ok: true, inserted: data?.length ?? seeds.length };
}
