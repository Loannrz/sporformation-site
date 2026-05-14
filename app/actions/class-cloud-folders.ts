"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { isDirector, mayCreateStudentInboxSubfolder } from "@/lib/roles";
import {
  fetchClassCloudFoldersFlat,
  isClassFolderInStudentUploadTree,
} from "@/lib/data/school";
import type { ClassCloudFolderTemplateNode } from "@/lib/class-cloud-folder-template";
import { STUDENT_INBOX_FOLDER_KIND } from "@/lib/cloud/class-cloud-folder-helpers";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeName(name: string): string {
  return name.trim().slice(0, 120);
}

async function requireDirector() {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

async function verifyFolderInClass(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  classId: string,
  folderId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("class_cloud_folders")
    .select("id")
    .eq("id", folderId)
    .eq("class_id", classId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function verifyParentInClass(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  classId: string,
  parentId: string | null,
): Promise<boolean> {
  if (parentId === null) return true;
  return verifyFolderInClass(admin, classId, parentId);
}

export async function createClassCloudFolderAction(
  locale: AppLocale,
  input: { classId: string; parentId: string | null; name: string },
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string }
> {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false, error: gate.error };

  const name = normalizeName(input.name);
  if (!name) {
    return { ok: false, error: "NAME_REQUIRED" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  if (!UUID_RE.test(input.classId)) {
    return { ok: false, error: "INVALID_CLASS" };
  }
  if (input.parentId && !UUID_RE.test(input.parentId)) {
    return { ok: false, error: "INVALID_PARENT" };
  }

  const parentOk = await verifyParentInClass(
    admin,
    input.classId,
    input.parentId,
  );
  if (!parentOk) {
    return { ok: false, error: "INVALID_PARENT" };
  }

  const { data: siblings, error: sErr } = await (() => {
    let q = admin
      .from("class_cloud_folders")
      .select("sort_order")
      .eq("class_id", input.classId);
    q =
      input.parentId === null
        ? q.is("parent_id", null)
        : q.eq("parent_id", input.parentId);
    return q;
  })();
  if (sErr) return { ok: false, error: sErr.message };

  const maxSort = (siblings ?? []).reduce(
    (m, r) => Math.max(m, Number((r as { sort_order?: number }).sort_order ?? 0)),
    -1,
  );

  const { data: created, error: insErr } = await admin
    .from("class_cloud_folders")
    .insert({
      class_id: input.classId,
      parent_id: input.parentId,
      name,
      sort_order: maxSort + 1,
    })
    .select("id")
    .single();

  if (insErr || !created?.id) {
    return { ok: false, error: insErr?.message ?? "INSERT_FAILED" };
  }

  revalidateClassCloudPaths(locale, input.classId);
  return { ok: true, id: created.id as string };
}

export async function renameClassCloudFolderAction(
  locale: AppLocale,
  input: { classId: string; folderId: string; name: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false, error: gate.error };

  const name = normalizeName(input.name);
  if (!name) {
    return { ok: false, error: "NAME_REQUIRED" };
  }

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const ok = await verifyFolderInClass(admin, input.classId, input.folderId);
  if (!ok) return { ok: false, error: "NOT_FOUND" };

  const { data: meta } = await admin
    .from("class_cloud_folders")
    .select("id,is_system")
    .eq("id", input.folderId)
    .eq("class_id", input.classId)
    .maybeSingle();
  if ((meta as { is_system?: boolean } | null)?.is_system === true) {
    return { ok: false, error: "SYSTEM_FOLDER" };
  }

  const { error } = await admin
    .from("class_cloud_folders")
    .update({ name })
    .eq("id", input.folderId)
    .eq("class_id", input.classId);

  if (error) return { ok: false, error: error.message };

  revalidateClassCloudPaths(locale, input.classId);
  return { ok: true };
}

export async function deleteClassCloudFolderAction(
  locale: AppLocale,
  input: { classId: string; folderId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  if (!UUID_RE.test(input.classId) || !UUID_RE.test(input.folderId)) {
    return { ok: false, error: "INVALID_FOLDER" };
  }

  const ok = await verifyFolderInClass(admin, input.classId, input.folderId);
  if (!ok) return { ok: false, error: "NOT_FOUND" };

  const { data: meta } = await admin
    .from("class_cloud_folders")
    .select("id,is_system")
    .eq("id", input.folderId)
    .eq("class_id", input.classId)
    .maybeSingle();
  if ((meta as { is_system?: boolean } | null)?.is_system === true) {
    return { ok: false, error: "SYSTEM_FOLDER" };
  }

  const { error } = await admin
    .from("class_cloud_folders")
    .delete()
    .eq("id", input.folderId)
    .eq("class_id", input.classId);

  if (error) return { ok: false, error: error.message };

  revalidateClassCloudPaths(locale, input.classId);
  return { ok: true };
}

export async function reorderClassCloudFoldersAction(
  locale: AppLocale,
  input: {
    classId: string;
    parentId: string | null;
    orderedIds: string[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const parentOk = await verifyParentInClass(
    admin,
    input.classId,
    input.parentId,
  );
  if (!parentOk) return { ok: false, error: "INVALID_PARENT" };

  let ids = input.orderedIds.filter((id) => UUID_RE.test(id));

  let rootRows: { id: string; system_kind?: string | null }[] | null = null;
  if (input.parentId === null) {
    const { data } = await admin
      .from("class_cloud_folders")
      .select("id,system_kind")
      .eq("class_id", input.classId)
      .is("parent_id", null);
    rootRows = data ?? null;
  }

  const inboxHit = rootRows?.find(
    (r) => r.system_kind === STUDENT_INBOX_FOLDER_KIND,
  )?.id;
  if (input.parentId === null && inboxHit && ids.includes(inboxHit)) {
    ids = [inboxHit, ...ids.filter((id) => id !== inboxHit)];
  }

  if (ids.length === 0) return { ok: false, error: "EMPTY" };

  const { data: rows, error: qErr } = await (() => {
    let q = admin
      .from("class_cloud_folders")
      .select("id")
      .eq("class_id", input.classId);
    q =
      input.parentId === null
        ? q.is("parent_id", null)
        : q.eq("parent_id", input.parentId);
    return q;
  })();

  if (qErr) return { ok: false, error: qErr.message };

  const existing = new Set((rows ?? []).map((r) => (r as { id: string }).id));
  if (existing.size !== ids.length) {
    return { ok: false, error: "MISMATCH" };
  }
  for (const id of ids) {
    if (!existing.has(id)) {
      return { ok: false, error: "MISMATCH" };
    }
  }

  for (let i = 0; i < ids.length; i += 1) {
    const { error: uErr } = await admin
      .from("class_cloud_folders")
      .update({ sort_order: i })
      .eq("id", ids[i])
      .eq("class_id", input.classId);
    if (uErr) return { ok: false, error: uErr.message };
  }

  revalidateClassCloudPaths(locale, input.classId);
  return { ok: true };
}

const MAX_TEMPLATE_NODES = 250;
const MAX_TEMPLATE_DEPTH = 20;

function sanitizeTemplateRootsFromPayload(
  roots: unknown,
): ClassCloudFolderTemplateNode[] | null {
  if (!Array.isArray(roots)) return null;
  let count = 0;
  function parseLevel(
    items: unknown[],
    depth: number,
  ): ClassCloudFolderTemplateNode[] | null {
    if (depth > MAX_TEMPLATE_DEPTH) return null;
    const res: ClassCloudFolderTemplateNode[] = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const nm = normalizeName(String((item as { name?: unknown }).name ?? ""));
      if (!nm) continue;
      count += 1;
      if (count > MAX_TEMPLATE_NODES) return null;
      const cr = (item as { children?: unknown }).children;
      const nextLevel = Array.isArray(cr) ? cr : [];
      const children = parseLevel(nextLevel, depth + 1);
      if (children === null) return null;
      res.push({ name: nm, children });
    }
    return res;
  }
  return parseLevel(roots, 0);
}

async function maxSortUnderParent(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  classId: string,
  parentId: string | null,
): Promise<number> {
  let q = admin
    .from("class_cloud_folders")
    .select("sort_order")
    .eq("class_id", classId);
  q =
    parentId === null ? q.is("parent_id", null) : q.eq("parent_id", parentId);
  const { data: siblings, error } = await q;
  if (error) throw new Error(error.message);
  return (siblings ?? []).reduce(
    (m, r) =>
      Math.max(m, Number((r as { sort_order?: number }).sort_order ?? 0)),
    -1,
  );
}

async function findSiblingFolderIdByName(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  classId: string,
  parentId: string | null,
  name: string,
): Promise<string | null> {
  let q = admin
    .from("class_cloud_folders")
    .select("id")
    .eq("class_id", classId)
    .eq("name", name)
    .limit(1);
  q =
    parentId === null ? q.is("parent_id", null) : q.eq("parent_id", parentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const row = data?.[0] as { id?: string } | undefined;
  return row?.id ?? null;
}

async function ensureTemplateSubtree(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  classId: string,
  parentId: string | null,
  nodes: ClassCloudFolderTemplateNode[],
): Promise<number> {
  let created = 0;
  for (const node of nodes) {
    const nm = normalizeName(node.name);
    if (!nm) continue;
    let folderId = await findSiblingFolderIdByName(
      admin,
      classId,
      parentId,
      nm,
    );
    if (!folderId) {
      const sortMax = await maxSortUnderParent(admin, classId, parentId);
      const { data: inserted, error: insErr } = await admin
        .from("class_cloud_folders")
        .insert({
          class_id: classId,
          parent_id: parentId,
          name: nm,
          sort_order: sortMax + 1,
          is_system: false,
          system_kind: null,
        })
        .select("id")
        .single();
      if (insErr || !inserted?.id) {
        throw new Error(insErr?.message ?? "INSERT_FAILED");
      }
      folderId = inserted.id as string;
      created += 1;
    }
    created += await ensureTemplateSubtree(
      admin,
      classId,
      folderId,
      node.children ?? [],
    );
  }
  return created;
}

export async function applyClassCloudFolderTemplateAction(
  locale: AppLocale,
  input: { classId: string; roots: unknown },
): Promise<
  | { ok: true; createdCount: number }
  | { ok: false; error: string }
> {
  const gate = await requireDirector();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  if (!UUID_RE.test(input.classId)) {
    return { ok: false, error: "INVALID_CLASS" };
  }

  const roots = sanitizeTemplateRootsFromPayload(input.roots);
  if (!roots) {
    return { ok: false, error: "INVALID_TEMPLATE" };
  }
  if (roots.length === 0) {
    return { ok: true, createdCount: 0 };
  }

  try {
    const createdCount = await ensureTemplateSubtree(
      admin,
      input.classId,
      null,
      roots,
    );
    revalidateClassCloudPaths(locale, input.classId);
    return { ok: true, createdCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export type CreateStudentInboxSubfolderError =
  | "UNAUTH"
  | "FORBIDDEN"
  | "NO_SERVICE_ROLE"
  | "INVALID_CLASS"
  | "INVALID_PARENT"
  | "NAME_REQUIRED"
  | "INVALID_PARENT_FOLDER"
  | string;

/** Sous-dossier sous « Documents des élèves » (enseignants / direction avec dépôt cloud). */
export async function createStudentInboxSubfolderAction(
  locale: AppLocale,
  input: { classId: string; parentFolderId: string; name: string },
): Promise<{ ok: true; id: string } | { ok: false; error: CreateStudentInboxSubfolderError }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "UNAUTH" };

  const name = normalizeName(input.name);
  if (!name) return { ok: false, error: "NAME_REQUIRED" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  if (!UUID_RE.test(input.classId)) return { ok: false, error: "INVALID_CLASS" };
  if (!UUID_RE.test(input.parentFolderId)) {
    return { ok: false, error: "INVALID_PARENT" };
  }

  if (!mayCreateStudentInboxSubfolder(user, input.classId)) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const rows = await fetchClassCloudFoldersFlat(input.classId);
  if (!isClassFolderInStudentUploadTree(rows, input.parentFolderId)) {
    return { ok: false, error: "INVALID_PARENT_FOLDER" };
  }

  const { data: siblings, error: sErr } = await admin
    .from("class_cloud_folders")
    .select("sort_order")
    .eq("class_id", input.classId)
    .eq("parent_id", input.parentFolderId);
  if (sErr) return { ok: false, error: sErr.message };

  const maxSort = (siblings ?? []).reduce(
    (m, r) =>
      Math.max(m, Number((r as { sort_order?: number }).sort_order ?? 0)),
    -1,
  );

  const { data: created, error: insErr } = await admin
    .from("class_cloud_folders")
    .insert({
      class_id: input.classId,
      parent_id: input.parentFolderId,
      name,
      sort_order: maxSort + 1,
      is_system: false,
      system_kind: null,
    })
    .select("id")
    .single();

  if (insErr || !created?.id) {
    return { ok: false, error: insErr?.message ?? "INSERT_FAILED" };
  }

  revalidateClassCloudPaths(locale, input.classId);
  return { ok: true, id: created.id as string };
}

function revalidateClassCloudPaths(locale: AppLocale, classId: string) {
  revalidatePath(`/${locale}/administration/classes/${classId}`);
  revalidatePath(`/${locale}/cloud`);
  revalidatePath(`/${locale}/cloud/classe-${classId}`);
}
