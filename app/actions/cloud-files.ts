"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import type { UpdateCloudDocumentMetadataResult } from "@/lib/cloud-document-metadata";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";

const MAX_BYTES = 50 * 1024 * 1024;
const BUCKET = "documents";

function sanitizeFileName(name: string): string {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[^\w.\- ()àâäéèêëïîôùûçÀÂÄÉÈÊËÏÎÔÙÛÇ]/gi, "_");
  return base.slice(0, 180) || "document";
}

export type UploadCloudDocumentErrorCode =
  | "UNAUTH"
  | "NO_SERVICE_ROLE"
  | "FILE_REQUIRED"
  | "FILE_TOO_LARGE"
  | "MISSING_FIELDS"
  | "INVALID_VERSION"
  | "STUDENT_UNKNOWN"
  | "STUDENT_CLASS_MISMATCH"
  | "UPLOAD_FAILED";

export async function uploadCloudDocumentAction(
  locale: AppLocale,
  formData: FormData,
): Promise<
  { ok: true } | { ok: false; error: UploadCloudDocumentErrorCode; detail?: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "FILE_REQUIRED" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }

  const documentName = String(formData.get("documentName") ?? "").trim();
  const versionStr = String(formData.get("version") ?? "").trim();
  const classIdRaw = String(formData.get("classId") ?? "").trim();
  const studentIdRaw = String(formData.get("studentId") ?? "").trim();

  if (!documentName || !versionStr) {
    return { ok: false, error: "MISSING_FIELDS" };
  }

  const version = parseInt(versionStr, 10);
  if (!Number.isFinite(version) || version < 1) {
    return { ok: false, error: "INVALID_VERSION" };
  }

  let classId: string | null = null;
  if (classIdRaw && classIdRaw !== "__none__") {
    classId = classIdRaw;
  }

  let studentId: string | null = null;
  if (studentIdRaw && studentIdRaw !== "__none__") {
    studentId = studentIdRaw;
  }

  if (studentId) {
    const { data: stRow, error: stErr } = await admin
      .from("students")
      .select("id,class_id")
      .eq("id", studentId)
      .maybeSingle();
    if (stErr || !stRow) {
      return { ok: false, error: "STUDENT_UNKNOWN" };
    }
    const stClass = (stRow.class_id as string | null | undefined) ?? null;
    if (classId && stClass && classId !== stClass) {
      return { ok: false, error: "STUDENT_CLASS_MISMATCH" };
    }
    if (!classId && stClass) {
      classId = stClass;
    }
  }

  const safeName = sanitizeFileName(file.name);
  const fileId = randomUUID();
  const storagePath = `cloud/${fileId}/v${version}/${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (upErr) {
    return {
      ok: false,
      error: "UPLOAD_FAILED",
      detail: upErr.message,
    };
  }

  const row: Record<string, unknown> = {
    id: fileId,
    logical_key: fileId,
    bucket_id: BUCKET,
    current_path: storagePath,
    class_id: classId,
    owner_id: user.id,
    student_id: studentId,
    mime: file.type || null,
    title: documentName,
    description: "",
  };

  const { error: insErr } = await admin.from("files").insert(row);
  if (insErr) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: "UPLOAD_FAILED",
      detail: insErr.message,
    };
  }

  const { error: vErr } = await admin.from("file_versions").insert({
    file_id: fileId,
    storage_path: storagePath,
    version,
    uploaded_by: user.id,
  });
  if (vErr) {
    await admin.from("files").delete().eq("id", fileId);
    await admin.storage.from(BUCKET).remove([storagePath]);
    return {
      ok: false,
      error: "UPLOAD_FAILED",
      detail: vErr.message,
    };
  }

  const folderSlug = String(formData.get("folderSlug") ?? "").trim();

  revalidatePath(`/${locale}/cloud`);
  if (folderSlug) {
    revalidatePath(`/${locale}/cloud/${folderSlug}`);
  }

  return { ok: true };
}

export type { UpdateCloudDocumentMetadataErrorCode, UpdateCloudDocumentMetadataResult } from "@/lib/cloud-document-metadata";

export async function updateCloudDocumentMetadataAction(
  locale: AppLocale,
  formData: FormData,
): Promise<UpdateCloudDocumentMetadataResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const fileId = String(formData.get("fileId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const classIdRaw = String(formData.get("classId") ?? "").trim();
  const studentIdRaw = String(formData.get("studentId") ?? "").trim();

  if (!fileId || !title) {
    return { ok: false, error: "MISSING_FIELDS" };
  }

  let classId: string | null = null;
  if (classIdRaw && classIdRaw !== "__none__") {
    classId = classIdRaw;
  }

  let studentId: string | null = null;
  if (studentIdRaw && studentIdRaw !== "__none__") {
    studentId = studentIdRaw;
  }

  if (studentId) {
    const { data: stRow, error: stErr } = await admin
      .from("students")
      .select("id,class_id")
      .eq("id", studentId)
      .maybeSingle();
    if (stErr || !stRow) {
      return { ok: false, error: "STUDENT_UNKNOWN" };
    }
    const stClass = (stRow.class_id as string | null | undefined) ?? null;
    if (classId && stClass && classId !== stClass) {
      return { ok: false, error: "STUDENT_CLASS_MISMATCH" };
    }
    if (!classId && stClass) {
      classId = stClass;
    }
  }

  const { data: existing, error: fetchErr } = await admin
    .from("files")
    .select("id,owner_id")
    .eq("id", fileId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { ok: false, error: "FILE_NOT_FOUND" };
  }

  const depositorId =
    (existing.owner_id as string | null | undefined) ?? null;
  const mayEdit =
    user.role === "DIRECTEUR" ||
    (depositorId !== null && depositorId === user.id);
  if (!mayEdit) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const { error: updErr } = await admin
    .from("files")
    .update({
      title,
      description,
      class_id: classId,
      student_id: studentId,
    })
    .eq("id", fileId);

  if (updErr) {
    return {
      ok: false,
      error: "UPDATE_FAILED",
      detail: updErr.message,
    };
  }

  const folderSlug = String(formData.get("folderSlug") ?? "").trim();
  revalidatePath(`/${locale}/cloud`);
  if (folderSlug) {
    revalidatePath(`/${locale}/cloud/${folderSlug}`);
  }

  return { ok: true };
}
