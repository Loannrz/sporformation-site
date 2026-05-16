"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import type { UpdateCloudDocumentMetadataResult } from "@/lib/cloud-document-metadata";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CloudDocumentAudience } from "@/lib/cloud-document-audience";
import { parseCloudDocumentAudienceFromForm } from "@/lib/cloud-document-audience";
import {
  buildClassCloudFolderTree,
  collectStudentDepositAccessibleFolderIds,
  fetchClassCloudFoldersFlat,
  flattenClassCloudFolderOptions,
  flattenClassCloudStudentInboxOptions,
  resolveStudentClassCloudDepositScope,
  studentMayAccessClassCloudDepositFolder,
} from "@/lib/data/school";
import { hasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { sanitizeStorageObjectFileName } from "@/lib/storage-filename";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";
import { viewerHasEstablishmentCloudScope } from "@/lib/cloud-teacher-scope";
import type { SupabaseClient } from "@supabase/supabase-js";

const CLASS_FOLDER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_BYTES = 50 * 1024 * 1024;
const BUCKET = "documents";

export type UploadCloudDocumentErrorCode =
  | "UNAUTH"
  | "NO_SERVICE_ROLE"
  | "FILE_REQUIRED"
  | "FILE_TOO_LARGE"
  | "MISSING_FIELDS"
  | "INVALID_VERSION"
  | "INVALID_AUDIENCE"
  | "STUDENT_UNKNOWN"
  | "STUDENT_CLASS_MISMATCH"
  | "STUDENT_CLOUD_FORBIDDEN"
  | "STUDENT_FOLDER_REQUIRED"
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

  let cloudAudienceResolved: CloudDocumentAudience;
  if (user.role === "ELEVE") {
    if (!hasPermission(user, "ACCESS_STUDENT_CLOUD")) {
      return { ok: false, error: "UNAUTH" };
    }
    cloudAudienceResolved = "STUDENTS";
  } else {
    const parsed = parseCloudDocumentAudienceFromForm(
      String(formData.get("cloudAudience") ?? ""),
    );
    if (!parsed) {
      return { ok: false, error: "INVALID_AUDIENCE" };
    }
    cloudAudienceResolved = parsed;
  }

  let classId: string | null = null;
  if (classIdRaw && classIdRaw !== "__none__") {
    classId = classIdRaw;
  }

  let studentId: string | null =
    user.role === "ELEVE" ? (user.studentId ?? null) : null;
  if (user.role !== "ELEVE" && studentIdRaw && studentIdRaw !== "__none__") {
    studentId = studentIdRaw;
  }

  if (
    user.role === "ELEVE" &&
    (!studentId ||
      !classId ||
      !user.studentClassId ||
      classId !== user.studentClassId)
  ) {
    return { ok: false, error: "STUDENT_CLOUD_FORBIDDEN" };
  }

  if (studentId && user.role !== "ELEVE") {
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

  if (user.role !== "ELEVE") {
    if (!classId) {
      return { ok: false, error: "MISSING_FIELDS" };
    }
  }

  let classFolderId: string | null = null;
  const classFolderRaw = String(formData.get("classFolderId") ?? "").trim();
  if (classFolderRaw && classFolderRaw !== "__root__") {
    classFolderId = classFolderRaw;
  }

  if (classFolderId) {
    if (!classId) {
      return { ok: false, error: "MISSING_FIELDS" };
    }
    const { data: fRow } = await admin
      .from("class_cloud_folders")
      .select("id")
      .eq("id", classFolderId)
      .eq("class_id", classId)
      .maybeSingle();
    if (!fRow) {
      return {
        ok: false,
        error: "UPLOAD_FAILED",
        detail: "INVALID_CLASS_FOLDER",
      };
    }
  }

  if (user.role === "ELEVE") {
    if (!classId || !classFolderId) {
      return { ok: false, error: "STUDENT_FOLDER_REQUIRED" };
    }
    const inboxRows = await fetchClassCloudFoldersFlat(classId);
    if (
      !studentMayAccessClassCloudDepositFolder(inboxRows, classFolderId)
    ) {
      return { ok: false, error: "STUDENT_CLOUD_FORBIDDEN" };
    }
  }

  const safeName = sanitizeStorageObjectFileName(file.name);
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

  // Les élèves n'ont pas de ligne `profiles` : les FK owner_id / uploaded_by /
  // actor_id (vers profiles.id) refuseraient l'insertion. Le déposant est
  // identifié par files.student_id.
  const profileActorId = user.role === "ELEVE" ? null : user.id;

  const row: Record<string, unknown> = {
    id: fileId,
    logical_key: fileId,
    bucket_id: BUCKET,
    current_path: storagePath,
    class_id: classId,
    owner_id: profileActorId,
    student_id: studentId,
    mime: file.type || null,
    title: documentName,
    description: "",
    cloud_audience: cloudAudienceResolved,
  };
  if (classFolderId) {
    row.class_folder_id = classFolderId;
  }

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
    uploaded_by: profileActorId,
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

  await logActivity({
    ...actorFromSession(user),
    actorId: profileActorId,
    action: "FILE_UPLOADED",
    entityType: "file",
    entityId: fileId,
    entityLabel: documentName,
    meta: {
      file_name: file.name,
      mime: file.type || null,
      size_bytes: file.size,
      version,
      class_id: classId,
      student_id: studentId,
      class_folder_id: classFolderId,
      cloud_audience: cloudAudienceResolved,
    },
  });

  revalidatePath(`/${locale}/cloud`);
  if (folderSlug) {
    revalidatePath(`/${locale}/cloud/${folderSlug}`);
  }

  return { ok: true };
}

/** Liste racine + sous-dossiers (indentés) pour le sélecteur d’upload / édition. */
export async function fetchClassCloudFolderPickOptionsAction(
  locale: AppLocale,
  classId: string,
): Promise<
  | { ok: true; options: { id: string; label: string }[] }
  | { ok: false; error: "UNAUTH" | "INVALID_CLASS" }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };

  if (!CLASS_FOLDER_UUID_RE.test(classId)) {
    return { ok: false, error: "INVALID_CLASS" };
  }

  if (user.role === "ELEVE") {
    if (!hasPermission(user, "ACCESS_STUDENT_CLOUD")) {
      return { ok: false, error: "UNAUTH" };
    }
    if (!user.studentClassId || user.studentClassId !== classId) {
      return { ok: false, error: "INVALID_CLASS" };
    }
    const rows = await fetchClassCloudFoldersFlat(classId);
    const tree = buildClassCloudFolderTree(rows);
    const t = await getTranslations({ locale, namespace: "cloud" });
    const depositScope = resolveStudentClassCloudDepositScope(rows);
    const allowed = new Set(
      collectStudentDepositAccessibleFolderIds(rows, depositScope),
    );
    const options = flattenClassCloudStudentInboxOptions(
      tree,
      t("studentInboxPlacementRoot"),
    ).filter((opt) => allowed.has(opt.id));
    return { ok: true, options };
  }

  const rows = await fetchClassCloudFoldersFlat(classId);
  const tree = buildClassCloudFolderTree(rows);
  const t = await getTranslations({ locale, namespace: "cloud" });
  const options = flattenClassCloudFolderOptions(tree, t("uploadFolderRoot"));

  return { ok: true, options };
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

  let cloudAudienceEdit: CloudDocumentAudience;
  if (user.role === "ELEVE") {
    cloudAudienceEdit = "STUDENTS";
  } else {
    const parsedAudience = parseCloudDocumentAudienceFromForm(
      String(formData.get("cloudAudience") ?? ""),
    );
    if (!parsedAudience) {
      return { ok: false, error: "INVALID_AUDIENCE" };
    }
    cloudAudienceEdit = parsedAudience;
  }

  let classId: string | null = null;
  if (classIdRaw && classIdRaw !== "__none__") {
    classId = classIdRaw;
  }

  let studentId: string | null =
    user.role === "ELEVE" ? (user.studentId ?? null) : null;
  if (user.role !== "ELEVE" && studentIdRaw && studentIdRaw !== "__none__") {
    studentId = studentIdRaw;
  }

  if (studentId && user.role !== "ELEVE") {
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

  const classFolderField = formData.get("classFolderId");
  let nextClassFolderId: string | null | undefined = undefined;
  if (classFolderField !== null) {
    const raw = String(classFolderField ?? "").trim();
    if (!raw || raw === "__root__") {
      nextClassFolderId = null;
    } else {
      nextClassFolderId = raw;
    }
  }

  const { data: existing, error: fetchErr } = await admin
    .from("files")
    .select("id,owner_id,class_id,class_folder_id,student_id")
    .eq("id", fileId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { ok: false, error: "FILE_NOT_FOUND" };
  }

  const classIdMerged =
    classId ?? ((existing.class_id as string | null | undefined) ?? null);

  if (user.role !== "ELEVE" && !classIdMerged) {
    return { ok: false, error: "MISSING_FIELDS" };
  }

  if (nextClassFolderId !== undefined && nextClassFolderId) {
    if (!classIdMerged) {
      return { ok: false, error: "MISSING_FIELDS" };
    }
    const { data: fRow } = await admin
      .from("class_cloud_folders")
      .select("id")
      .eq("id", nextClassFolderId)
      .eq("class_id", classIdMerged)
      .maybeSingle();
    if (!fRow) {
      return { ok: false, error: "UPDATE_FAILED", detail: "INVALID_FOLDER" };
    }
  }

  if (user.role === "ELEVE") {
    if (!user.studentClassId || classIdMerged !== user.studentClassId) {
      return { ok: false, error: "FORBIDDEN" };
    }
    const inboxRows = classIdMerged
      ? await fetchClassCloudFoldersFlat(classIdMerged)
      : [];
    if (nextClassFolderId !== undefined) {
      if (
        nextClassFolderId === null ||
        !classIdMerged ||
        !studentMayAccessClassCloudDepositFolder(
          inboxRows,
          nextClassFolderId,
        )
      ) {
        return { ok: false, error: "FORBIDDEN", detail: "INVALID_FOLDER_MOVE" };
      }
    }
  }

  const depositorId =
    (existing.owner_id as string | null | undefined) ?? null;
  const depositorStudentId =
    (existing.student_id as string | null | undefined) ?? null;
  const mayEdit =
    user.role === "DIRECTEUR" ||
    (depositorId !== null && depositorId === user.id) ||
    (user.role === "ELEVE" &&
      !!user.studentId &&
      depositorStudentId === user.studentId);
  if (!mayEdit) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const { error: updErr } = await admin
    .from("files")
    .update({
      title,
      description,
      cloud_audience: cloudAudienceEdit,
      class_id: classIdMerged,
      student_id: studentId,
      ...(nextClassFolderId !== undefined
        ? { class_folder_id: nextClassFolderId }
        : {}),
    })
    .eq("id", fileId);

  if (updErr) {
    return {
      ok: false,
      error: "UPDATE_FAILED",
      detail: updErr.message,
    };
  }

  await logActivity({
    ...actorFromSession(user),
    actorId: user.role === "ELEVE" ? null : user.id,
    action: "FILE_METADATA_UPDATED",
    entityType: "file",
    entityId: fileId,
    entityLabel: title,
    meta: {
      class_id: classIdMerged,
      student_id: studentId,
      cloud_audience: cloudAudienceEdit,
      class_folder_id:
        nextClassFolderId !== undefined ? nextClassFolderId : undefined,
    },
  });

  const folderSlug = String(formData.get("folderSlug") ?? "").trim();
  revalidatePath(`/${locale}/cloud`);
  if (folderSlug) {
    revalidatePath(`/${locale}/cloud/${folderSlug}`);
  }

  return { ok: true };
}

async function deleteCloudFileStorageAndRow(
  admin: SupabaseClient,
  fileId: string,
): Promise<void> {
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

export type DeleteCloudDocumentErrorCode =
  | "UNAUTH"
  | "NO_SERVICE_ROLE"
  | "FORBIDDEN"
  | "FILE_NOT_FOUND";

export async function deleteCloudDocumentAction(
  locale: AppLocale,
  fileId: string,
  folderSlug?: string | null,
): Promise<
  { ok: true } | { ok: false; error: DeleteCloudDocumentErrorCode }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };
  if (!viewerHasEstablishmentCloudScope(user)) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const { data: existing, error: fetchErr } = await admin
    .from("files")
    .select("id")
    .eq("id", fileId)
    .maybeSingle();
  if (fetchErr || !existing) {
    return { ok: false, error: "FILE_NOT_FOUND" };
  }

  await deleteCloudFileStorageAndRow(admin, fileId);

  await logActivity({
    ...actorFromSession(user),
    actorId: user.id,
    action: "FILE_METADATA_UPDATED",
    entityType: "file",
    entityId: fileId,
    entityLabel: null,
    meta: { deleted: true },
  });

  revalidatePath(`/${locale}/cloud`);
  const slug = String(folderSlug ?? "").trim();
  if (slug) {
    revalidatePath(`/${locale}/cloud/${slug}`);
  }

  return { ok: true };
}

export type DeleteCloudDocumentsByOwnerErrorCode =
  | "UNAUTH"
  | "NO_SERVICE_ROLE"
  | "FORBIDDEN"
  | "INVALID_OWNER";

export async function deleteCloudDocumentsByOwnerAction(
  locale: AppLocale,
  ownerId: string,
): Promise<
  | { ok: true; deleted: number }
  | { ok: false; error: DeleteCloudDocumentsByOwnerErrorCode }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };
  if (!viewerHasEstablishmentCloudScope(user)) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const trimmed = ownerId.trim();
  if (!CLASS_FOLDER_UUID_RE.test(trimmed)) {
    return { ok: false, error: "INVALID_OWNER" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const { data: rows, error: listErr } = await admin
    .from("files")
    .select("id")
    .eq("owner_id", trimmed);
  if (listErr) {
    return { ok: false, error: "NO_SERVICE_ROLE" };
  }

  const ids = (rows ?? []).map((r) => r.id as string).filter(Boolean);
  for (const id of ids) {
    await deleteCloudFileStorageAndRow(admin, id);
  }

  await logActivity({
    ...actorFromSession(user),
    actorId: user.id,
    action: "FILE_METADATA_UPDATED",
    entityType: "file",
    entityId: trimmed,
    entityLabel: null,
    meta: { bulk_deleted_by_owner: true, count: ids.length },
  });

  revalidatePath(`/${locale}/cloud`);
  revalidatePath(
    `/${locale}/cloud/${encodeURIComponent(`prof-${trimmed}`)}`,
  );

  return { ok: true, deleted: ids.length };
}
