"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { canManageTeacherAccounts } from "@/lib/roles";
import { sanitizeStorageObjectFileName } from "@/lib/storage-filename";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCloudDocumentAudience } from "@/lib/cloud-document-audience";
import {
  attachSignedUrlsToCloudFiles,
  type CloudFolderFileRow,
} from "@/lib/data/school";
import {
  fetchAllTeacherProfileIdsForVoluntary,
  fetchVoluntaryRecipientsForRequest,
  type VoluntaryDocumentScopeKind,
} from "@/lib/data/teacher-voluntary-documents";

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

export async function createVoluntaryDocumentRequestAction(
  locale: AppLocale,
  input: {
    label: string;
    description?: string | null;
    scopeKind: VoluntaryDocumentScopeKind;
    teacherIds?: string[];
  },
): Promise<
  | { ok: true; requestId: string }
  | {
      ok: false;
      error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" | "INVALID" | "NO_RECIPIENTS";
    }
> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }

  const label = input.label.trim();
  if (!label) return { ok: false, error: "INVALID" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  let teacherIds: string[] = [];
  if (input.scopeKind === "all_staff_teachers") {
    teacherIds = await fetchAllTeacherProfileIdsForVoluntary(admin);
  } else {
    const raw = input.teacherIds ?? [];
    const unique = [...new Set(raw.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) return { ok: false, error: "INVALID" };
    const { data: profs } = await admin
      .from("profiles")
      .select("id, base_role")
      .in("id", unique)
      .in("base_role", ["PROFESSEUR", "PROF_PRINCIPAL"]);
    teacherIds = (profs ?? [])
      .map((p) => p.id as string)
      .filter((id) => unique.includes(id));
    if (!teacherIds.length) return { ok: false, error: "NO_RECIPIENTS" };
  }

  if (!teacherIds.length) return { ok: false, error: "NO_RECIPIENTS" };

  const { data: insReq, error: insErr } = await admin
    .from("teacher_voluntary_document_requests")
    .insert({
      label,
      description: input.description?.trim() || null,
      scope_kind: input.scopeKind,
      status: "open",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !insReq) {
    return { ok: false, error: "NO_SERVICE" };
  }

  const requestId = insReq.id as string;
  const rows = teacherIds.map((teacher_profile_id) => ({
    request_id: requestId,
    teacher_profile_id,
  }));

  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const { error: recErr } = await admin.from("teacher_voluntary_document_recipients").insert(part);
    if (recErr) {
      await admin.from("teacher_voluntary_document_requests").delete().eq("id", requestId);
      return { ok: false, error: "NO_SERVICE" };
    }
  }

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_VOLUNTARY_DOC_REQUEST_CREATED",
    entityType: "teacher_voluntary_document_request",
    entityId: requestId,
    entityLabel: label,
    meta: { scope: input.scopeKind, recipients: teacherIds.length },
  });

  revalidatePath(`/${locale}/admin/teacher-documents`);
  return { ok: true, requestId };
}

export async function closeVoluntaryDocumentRequestAction(
  locale: AppLocale,
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" }> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("teacher_voluntary_document_requests")
    .update({ status: "closed", closed_at: now })
    .eq("id", requestId)
    .eq("status", "open");

  if (error) return { ok: false, error: "NO_SERVICE" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_VOLUNTARY_DOC_REQUEST_CLOSED",
    entityType: "teacher_voluntary_document_request",
    entityId: requestId,
  });

  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/documents-volontaires`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}

export async function excuseVoluntaryDocumentRecipientAction(
  locale: AppLocale,
  recipientId: string,
): Promise<
  | { ok: true }
  | {
      ok: false;
      error:
        | "UNAUTH"
        | "FORBIDDEN"
        | "NO_SERVICE"
        | "NOT_FOUND"
        | "INVALID_STATE"
        | "ALREADY_EXCUSED";
    }
> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { data: row, error: selErr } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      teacher_profile_id,
      file_id,
      admin_excused_at,
      request_id,
      teacher_voluntary_document_requests!inner ( status )
    `,
    )
    .eq("id", recipientId)
    .maybeSingle();

  if (selErr || !row) {
    return selErr ? { ok: false, error: "NO_SERVICE" } : { ok: false, error: "NOT_FOUND" };
  }

  if (row.admin_excused_at) {
    return { ok: false, error: "ALREADY_EXCUSED" };
  }

  const teacherProfileId = row.teacher_profile_id as string;
  const reqJoin = row.teacher_voluntary_document_requests as unknown as { status: string };
  if (reqJoin.status !== "open") {
    return { ok: false, error: "INVALID_STATE" };
  }
  if ((row.file_id as string | null) != null) {
    return { ok: false, error: "INVALID_STATE" };
  }

  if (user.role === "ADMINISTRATEUR") {
    const { data: teacher } = await admin
      .from("profiles")
      .select("base_role")
      .eq("id", teacherProfileId)
      .maybeSingle();
    const baseRole = (teacher?.base_role as string) ?? "";
    if (baseRole !== "PROFESSEUR" && baseRole !== "PROF_PRINCIPAL") {
      return { ok: false, error: "FORBIDDEN" };
    }
  }

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("teacher_voluntary_document_recipients")
    .update({
      admin_excused_at: now,
      admin_excused_by: user.id,
      voluntary_invalidated_at: null,
      voluntary_invalidated_by: null,
    })
    .eq("id", recipientId)
    .is("file_id", null)
    .is("admin_excused_at", null);

  if (upErr) return { ok: false, error: "NO_SERVICE" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_VOLUNTARY_DOC_RECIPIENT_EXCUSED",
    entityType: "teacher_voluntary_document_recipient",
    entityId: recipientId,
    meta: { request_id: row.request_id, teacher_profile_id: teacherProfileId },
  });

  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/documents-volontaires`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/administration/comptes/${teacherProfileId}`);
  return { ok: true };
}

export async function invalidateVoluntaryDocumentRecipientAction(
  locale: AppLocale,
  recipientId: string,
): Promise<
  | { ok: true }
  | {
      ok: false;
      error:
        | "UNAUTH"
        | "FORBIDDEN"
        | "NO_SERVICE"
        | "NOT_FOUND"
        | "INVALID_STATE";
    }
> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { data: row, error: selErr } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      teacher_profile_id,
      file_id,
      request_id,
      teacher_voluntary_document_requests!inner ( status )
    `,
    )
    .eq("id", recipientId)
    .maybeSingle();

  if (selErr || !row) {
    return selErr ? { ok: false, error: "NO_SERVICE" } : { ok: false, error: "NOT_FOUND" };
  }

  const fileId = row.file_id as string | null;
  if (!fileId) return { ok: false, error: "INVALID_STATE" };

  const reqJoin = row.teacher_voluntary_document_requests as unknown as { status: string };
  if (reqJoin.status !== "open") return { ok: false, error: "INVALID_STATE" };

  const teacherProfileId = row.teacher_profile_id as string;
  if (user.role === "ADMINISTRATEUR") {
    const { data: teacher } = await admin
      .from("profiles")
      .select("base_role")
      .eq("id", teacherProfileId)
      .maybeSingle();
    const baseRole = (teacher?.base_role as string) ?? "";
    if (baseRole !== "PROFESSEUR" && baseRole !== "PROF_PRINCIPAL") {
      return { ok: false, error: "FORBIDDEN" };
    }
  }

  await deleteFileCascade(admin, fileId);

  const now = new Date().toISOString();
  const { error: upErr } = await admin
    .from("teacher_voluntary_document_recipients")
    .update({
      file_id: null,
      uploaded_at: null,
      voluntary_invalidated_at: now,
      voluntary_invalidated_by: user.id,
    })
    .eq("id", recipientId);

  if (upErr) return { ok: false, error: "NO_SERVICE" };

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_VOLUNTARY_DOC_MARKED_INVALID",
    entityType: "teacher_voluntary_document_recipient",
    entityId: recipientId,
    meta: {
      request_id: row.request_id,
      teacher_profile_id: teacherProfileId,
      previous_file_id: fileId,
    },
  });

  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/documents-volontaires`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/administration/comptes/${teacherProfileId}`);
  return { ok: true };
}

export async function uploadVoluntaryDocumentRecipientAction(
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
  if (user.role !== "PROFESSEUR" && user.role !== "PROF_PRINCIPAL") {
    return { ok: false, error: "FORBIDDEN" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const recipientId = String(formData.get("recipientId") ?? "").trim();
  if (!recipientId) return { ok: false, error: "INVALID_REQUEST" };

  const { data: row, error: rErr } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      teacher_profile_id,
      file_id,
      request_id,
      admin_excused_at,
      teacher_voluntary_document_requests!inner ( status )
    `,
    )
    .eq("id", recipientId)
    .maybeSingle();

  if (rErr || !row || (row.teacher_profile_id as string) !== user.id) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const reqJoin = row.teacher_voluntary_document_requests as unknown as { status: string };
  if (reqJoin.status !== "open") {
    return { ok: false, error: "FORBIDDEN" };
  }
  if (row.admin_excused_at) {
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
  const storagePath = `teacher-voluntary/${recipientId}/v1/${safeName}`;
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
    logical_key: `teacher-voluntary-${recipientId}`,
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

  const nowIso = new Date().toISOString();
  const { error: uRecErr } = await admin
    .from("teacher_voluntary_document_recipients")
    .update({
      file_id: fileId,
      uploaded_at: nowIso,
      voluntary_invalidated_at: null,
      voluntary_invalidated_by: null,
    })
    .eq("id", recipientId)
    .eq("teacher_profile_id", user.id);

  if (uRecErr) {
    await deleteFileCascade(admin, fileId);
    return { ok: false, error: "UPLOAD_FAILED", detail: uRecErr.message };
  }

  if (oldFileId) {
    await deleteFileCascade(admin, oldFileId);
  }

  await logActivity({
    ...actorFromSession(user),
    action: "TEACHER_VOLUNTARY_DOC_UPLOADED",
    entityType: "teacher_voluntary_document_recipient",
    entityId: recipientId,
    entityLabel: documentLabel,
    meta: { file_id: fileId, request_id: row.request_id },
  });

  revalidatePath(`/${locale}/documents-volontaires`);
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/admin/teacher-documents`);
  revalidatePath(`/${locale}/cloud`);
  return { ok: true };
}

/** URL signée pour consulter ou télécharger une pièce voluntary déposée (fiche enseignant admin). */
export async function getTeacherVoluntaryRecipientSignedUrlAction(
  _locale: AppLocale,
  input: { recipientId: string; teacherProfileId: string },
): Promise<
  | { ok: true; signedUrl: string; title: string; mime: string | null }
  | {
      ok: false;
      error: "UNAUTH" | "FORBIDDEN" | "NO_SERVICE" | "NOT_FOUND" | "NO_FILE";
    }
> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };

  const { data: recRow } = await admin
    .from("teacher_voluntary_document_recipients")
    .select("id, teacher_profile_id, file_id")
    .eq("id", input.recipientId)
    .maybeSingle();

  if (!recRow || recRow.teacher_profile_id !== input.teacherProfileId) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const fileId = recRow.file_id as string | null;
  if (!fileId) return { ok: false, error: "NO_FILE" };

  const { data: teacher } = await admin
    .from("profiles")
    .select("base_role")
    .eq("id", input.teacherProfileId)
    .maybeSingle();

  if (!teacher) return { ok: false, error: "FORBIDDEN" };

  const baseRole = teacher.base_role as string;
  if (
    user.role === "ADMINISTRATEUR" &&
    baseRole !== "PROFESSEUR" &&
    baseRole !== "PROF_PRINCIPAL"
  ) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const { data: f } = await admin.from("files").select("*").eq("id", fileId).maybeSingle();
  if (!f) return { ok: false, error: "NOT_FOUND" };

  const row: CloudFolderFileRow = {
    id: fileId,
    title: (f.title as string)?.trim() || "document",
    description: (f.description as string) ?? "",
    mime: (f.mime as string | null) ?? null,
    createdAt: new Date(f.created_at as string).toISOString(),
    version: 1,
    cloudAudience: normalizeCloudDocumentAudience(f.cloud_audience as string),
    classId: (f.class_id as string | null) ?? null,
    ownerId: (f.owner_id as string | null) ?? null,
    studentId: (f.student_id as string | null) ?? null,
    classFolderId: (f.class_folder_id as string | null) ?? null,
    storagePath: (f.current_path as string) || null,
  };

  const [withUrl] = await attachSignedUrlsToCloudFiles([row]);
  if (!withUrl?.signedUrl) return { ok: false, error: "NO_SERVICE" };

  return {
    ok: true,
    signedUrl: withUrl.signedUrl,
    title: withUrl.title,
    mime: withUrl.mime,
  };
}

export async function listVoluntaryRecipientsForRequestAction(
  _locale: AppLocale,
  requestId: string,
): Promise<
  | {
      ok: true;
      rows: Awaited<ReturnType<typeof fetchVoluntaryRecipientsForRequest>>;
    }
  | { ok: false; error: "UNAUTH" | "NO_SERVICE" }
> {
  const user = await getSessionUser();
  if (!user || !canManageTeacherAccounts(user)) {
    return { ok: false, error: "UNAUTH" };
  }
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE" };
  const rows = await fetchVoluntaryRecipientsForRequest(admin, requestId);
  return { ok: true, rows };
}
