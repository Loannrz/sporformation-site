"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
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
  const description = String(formData.get("description") ?? "").trim();
  const versionStr = String(formData.get("version") ?? "").trim();
  const classIdRaw = String(formData.get("classId") ?? "").trim();

  if (!documentName || !description || !versionStr) {
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
    mime: file.type || null,
    title: documentName,
    description,
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
