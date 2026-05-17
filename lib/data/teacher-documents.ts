import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { SessionUser } from "@/types";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import { normalizeCloudDocumentAudience } from "@/lib/cloud-document-audience";
import {
  resolveTeacherDocumentsTrackingState,
  type TeacherDocumentsTrackingState,
} from "@/lib/data/teacher-documents-tracking";
import {
  attachSignedUrlsToCloudFiles,
  type CloudFolderFileRow,
} from "@/lib/data/school";

export type TeacherDocumentTemplateRow = {
  id: string;
  label: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  applies_to_new_teachers: boolean;
  created_at: string;
  updated_at: string;
};

export type TeacherDocumentRequestRow = {
  id: string;
  teacher_profile_id: string;
  template_id: string | null;
  label: string;
  description: string | null;
  sort_order: number;
  file_id: string | null;
  created_at: string;
};

export async function fetchTeacherDocumentTemplates(
  admin: SupabaseClient,
): Promise<TeacherDocumentTemplateRow[]> {
  const { data, error } = await admin
    .from("teacher_document_templates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as TeacherDocumentTemplateRow[];
}

export async function fetchTeacherDocumentRequestsForProfile(
  admin: SupabaseClient,
  teacherProfileId: string,
): Promise<TeacherDocumentRequestRow[]> {
  const { data, error } = await admin
    .from("teacher_document_requests")
    .select("*")
    .eq("teacher_profile_id", teacherProfileId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as TeacherDocumentRequestRow[];
}

export type TeacherOnboardingRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  base_role: string;
  teacher_employment_status: string | null;
  teacher_documents_bundle_submitted_at: string | null;
  teacher_documents_approved_at: string | null;
};

export type { TeacherDocumentsTrackingState };
export { resolveTeacherDocumentsTrackingState };

/**
 * Nombre de dossiers « complets et envoyés », en attente de validation direction
 * (`submitted`), même logique que l’onglet Suivi de l’admin documents enseignants.
 */
export async function countTeacherDocumentsAwaitingValidation(): Promise<number> {
  const admin = createAdminSupabase();
  if (!admin) return 0;

  const pendingRaw = await fetchPendingTeacherDocumentsProfiles(admin);
  if (!pendingRaw.length) return 0;

  const pendingIds = pendingRaw.map((p) => p.id);
  const { data: reqs } = await admin
    .from("teacher_document_requests")
    .select("teacher_profile_id, file_id")
    .in("teacher_profile_id", pendingIds);

  const meta = new Map<string, { total: number; filled: number }>();
  for (const id of pendingIds) {
    meta.set(id, { total: 0, filled: 0 });
  }
  for (const r of reqs ?? []) {
    const id = r.teacher_profile_id as string;
    const m = meta.get(id);
    if (!m) continue;
    m.total += 1;
    if (r.file_id) m.filled += 1;
  }

  let count = 0;
  for (const p of pendingRaw) {
    const m = meta.get(p.id) ?? { total: 0, filled: 0 };
    const state = resolveTeacherDocumentsTrackingState({
      totalRequests: m.total,
      filledRequests: m.filled,
      teacher_documents_bundle_submitted_at:
        p.teacher_documents_bundle_submitted_at,
    });
    if (state === "submitted") count += 1;
  }
  return count;
}

/** Nouvelles recrues sans accès complet. */
export async function fetchPendingTeacherDocumentsProfiles(
  admin: SupabaseClient,
): Promise<TeacherOnboardingRow[]> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id,first_name,last_name,email,base_role,teacher_employment_status,teacher_documents_bundle_submitted_at,teacher_documents_approved_at",
    )
    .in("base_role", ["PROFESSEUR", "PROF_PRINCIPAL"])
    .eq("teacher_employment_status", "NEW_TO_SCHOOL")
    .is("teacher_documents_approved_at", null)
    .order("last_name", { ascending: true });

  if (error || !data) return [];
  return data as TeacherOnboardingRow[];
}

/**
 * Accès dossiers validés par la direction (`teacher_documents_approved_at`).
 * Ne pas exiger de lignes dans `teacher_document_requests` : après migration ou
 * validation sans parcours demandes, le profil peut être approuvé sans cette table.
 */
export async function fetchValidatedTeacherDocumentsProfiles(
  admin: SupabaseClient,
): Promise<TeacherOnboardingRow[]> {
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id,first_name,last_name,email,base_role,teacher_employment_status,teacher_documents_bundle_submitted_at,teacher_documents_approved_at",
    )
    .in("base_role", ["PROFESSEUR", "PROF_PRINCIPAL"])
    .not("teacher_documents_approved_at", "is", null)
    .order("teacher_documents_approved_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(1000);

  if (error || !data) return [];

  return (data as TeacherOnboardingRow[]).filter(
    (row) => row.teacher_documents_approved_at != null,
  );
}

/** @deprecated utiliser fetchPendingTeacherDocumentsProfiles */
export async function fetchTeachersForDocumentsAdmin(
  admin: SupabaseClient,
): Promise<TeacherOnboardingRow[]> {
  return fetchPendingTeacherDocumentsProfiles(admin);
}

export type TeacherOnboardingCloudFile = CloudFolderFileRow & {
  signedUrl: string | null;
  requestLabel: string;
  requestId: string;
  teacherProfileId: string;
  teacherDisplayName: string;
  /** Parcours arrivée vs demandes hors blocage (campagnes voluntary). */
  source?: "onboarding" | "voluntary";
};

type TeacherCloudPair = {
  row: CloudFolderFileRow;
  requestLabel: string;
  requestId: string;
  teacherProfileId: string;
  teacherDisplayName: string;
  source: "onboarding" | "voluntary";
};

async function fetchOnboardingTeacherCloudPairs(
  admin: SupabaseClient,
  viewer: SessionUser,
  directorScope: boolean,
): Promise<TeacherCloudPair[]> {
  const { data: rows, error } = await admin
    .from("teacher_document_requests")
    .select("id, label, teacher_profile_id, file_id")
    .not("file_id", "is", null);

  if (error || !rows?.length) return [];

  const scoped = directorScope
    ? rows
    : rows.filter((r) => r.teacher_profile_id === viewer.id);

  if (!scoped.length) return [];

  const fileIds = scoped
    .map((r) => r.file_id as string)
    .filter((x): x is string => Boolean(x));
  const teacherIds = [
    ...new Set(
      scoped.map((r) => r.teacher_profile_id as string).filter(Boolean),
    ),
  ];

  const [{ data: fileRows }, { data: profRows }] = await Promise.all([
    admin.from("files").select("*").in("id", fileIds),
    admin.from("profiles").select("id, first_name, last_name").in("id", teacherIds),
  ]);

  const fileMap = new Map((fileRows ?? []).map((f) => [f.id as string, f]));
  const nameMap = new Map(
    (profRows ?? []).map((p) => [
      p.id as string,
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—",
    ]),
  );

  const pairs: TeacherCloudPair[] = [];

  for (const r of scoped) {
    const fid = r.file_id as string;
    const f = fileMap.get(fid);
    if (!f) continue;
    const tid = r.teacher_profile_id as string;
    pairs.push({
      source: "onboarding",
      requestId: r.id as string,
      requestLabel: r.label as string,
      teacherProfileId: tid,
      teacherDisplayName: nameMap.get(tid) ?? "—",
      row: {
        id: fid,
        title: (f.title as string)?.trim() || (r.label as string),
        description: (f.description as string) ?? "",
        mime: (f.mime as string | null) ?? null,
        createdAt: new Date(f.created_at as string).toISOString(),
        version: 1,
        cloudAudience: normalizeCloudDocumentAudience(
          f.cloud_audience as string,
        ),
        classId: (f.class_id as string | null) ?? null,
        ownerId: (f.owner_id as string | null) ?? null,
        studentId: (f.student_id as string | null) ?? null,
        classFolderId: (f.class_folder_id as string | null) ?? null,
        storagePath: (f.current_path as string) || null,
      },
    });
  }

  return pairs;
}

async function fetchVoluntaryTeacherCloudPairs(
  admin: SupabaseClient,
  viewer: SessionUser,
  directorScope: boolean,
): Promise<TeacherCloudPair[]> {
  const { data: rows, error } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      teacher_profile_id,
      file_id,
      teacher_voluntary_document_requests!inner ( label )
    `,
    )
    .not("file_id", "is", null);

  if (error || !rows?.length) return [];

  const scoped = directorScope
    ? rows
    : rows.filter((r) => r.teacher_profile_id === viewer.id);

  if (!scoped.length) return [];

  const fileIds = scoped
    .map((r) => r.file_id as string)
    .filter((x): x is string => Boolean(x));
  const teacherIds = [
    ...new Set(
      scoped.map((r) => r.teacher_profile_id as string).filter(Boolean),
    ),
  ];

  const [{ data: fileRows }, { data: profRows }] = await Promise.all([
    admin.from("files").select("*").in("id", fileIds),
    admin.from("profiles").select("id, first_name, last_name").in("id", teacherIds),
  ]);

  const fileMap = new Map((fileRows ?? []).map((f) => [f.id as string, f]));
  const nameMap = new Map(
    (profRows ?? []).map((p) => [
      p.id as string,
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—",
    ]),
  );

  const pairs: TeacherCloudPair[] = [];

  for (const r of scoped) {
    const fid = r.file_id as string;
    const f = fileMap.get(fid);
    if (!f) continue;
    const tid = r.teacher_profile_id as string;
    const req = r.teacher_voluntary_document_requests as unknown as {
      label: string;
    };
    pairs.push({
      source: "voluntary",
      requestId: r.id as string,
      requestLabel: req.label,
      teacherProfileId: tid,
      teacherDisplayName: nameMap.get(tid) ?? "—",
      row: {
        id: fid,
        title: (f.title as string)?.trim() || req.label,
        description: (f.description as string) ?? "",
        mime: (f.mime as string | null) ?? null,
        createdAt: new Date(f.created_at as string).toISOString(),
        version: 1,
        cloudAudience: normalizeCloudDocumentAudience(
          f.cloud_audience as string,
        ),
        classId: (f.class_id as string | null) ?? null,
        ownerId: (f.owner_id as string | null) ?? null,
        studentId: (f.student_id as string | null) ?? null,
        classFolderId: (f.class_folder_id as string | null) ?? null,
        storagePath: (f.current_path as string) || null,
      },
    });
  }

  return pairs;
}

export async function fetchTeacherOnboardingFilesForCloud(
  viewer: SessionUser,
): Promise<TeacherOnboardingCloudFile[]> {
  if (viewer.role === "ELEVE") return [];

  const admin = createAdminSupabase();
  if (!admin) return [];

  const directorScope = isDirector(viewer) || isStaffAdmin(viewer);

  const [onboardingPairs, voluntaryPairs] = await Promise.all([
    fetchOnboardingTeacherCloudPairs(admin, viewer, directorScope),
    fetchVoluntaryTeacherCloudPairs(admin, viewer, directorScope),
  ]);

  const pairList = [...onboardingPairs, ...voluntaryPairs];
  if (!pairList.length) return [];

  const withUrls = await attachSignedUrlsToCloudFiles(pairList.map((p) => p.row));

  return pairList.map((p, i) => {
    const u = withUrls[i];
    return {
      ...u,
      requestLabel: p.requestLabel,
      requestId: p.requestId,
      teacherProfileId: p.teacherProfileId,
      teacherDisplayName: p.teacherDisplayName,
      source: p.source,
    };
  });
}