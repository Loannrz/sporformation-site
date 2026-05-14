import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { SANCTION_TABLE_ROW_SELECT } from "@/lib/sanction-columns";
import { resolveSanctionsViewerScope } from "@/lib/sanctions-viewer-scope";
import type { SanctionType, SessionUser } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function db() {
  return createAdminSupabase() ?? (await createServerSupabase());
}

export type AdminActiveSanctionRow = {
  id: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  classId: string | null;
  className: string | null;
  type: SanctionType;
  title: string | null;
  description: string;
  occurredAt: string;
  createdAt: string;
  authorId: string | null;
};

export async function fetchAdminSanctionsLastSeenAt(
  profileId: string,
): Promise<string | null> {
  const supabase = await db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("admin_sanctions_last_seen_at")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { admin_sanctions_last_seen_at?: string | null })
    .admin_sanctions_last_seen_at;
  return raw ?? null;
}

/** Sanctions encore actives créées après la dernière consultation hub (pour badge). */
export async function fetchAdminSanctionsNewCount(
  profileId: string,
): Promise<number> {
  const supabase = await db();
  if (!supabase) return 0;

  const { data: prof } = await supabase
    .from("profiles")
    .select("admin_sanctions_last_seen_at")
    .eq("id", profileId)
    .maybeSingle();

  const since =
    (prof as { admin_sanctions_last_seen_at?: string | null } | null)
      ?.admin_sanctions_last_seen_at ?? new Date(0).toISOString();

  const { count, error } = await supabase
    .from("sanctions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .gt("created_at", since);

  if (error || count == null) return 0;
  return count;
}

export async function fetchActiveSanctionsCount(): Promise<number> {
  const supabase = await db();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("sanctions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (error || count == null) return 0;
  return count;
}

export async function fetchSanctionsCreatedSince(
  sinceIso: string,
): Promise<number> {
  const supabase = await db();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("sanctions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error || count == null) return 0;
  return count;
}

/** Entrées créées sur la période, dans le périmètre hub du viewer (bannière « cette semaine »). */
export async function fetchSanctionsCreatedSinceForViewer(
  user: SessionUser,
  sinceIso: string,
): Promise<number> {
  const supabase = await db();
  if (!supabase) return 0;

  const scope = await resolveSanctionsViewerScope(supabase, user);
  if (scope.kind === "none") return 0;

  let q = supabase
    .from("sanctions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);

  if (scope.kind === "authorOnly") {
    q = q.eq("author_id", scope.authorId);
  } else if (scope.kind === "studentIds") {
    q = q.in("student_id", scope.studentIds);
  }

  const { count, error } = await q;
  if (error || count == null) return 0;
  return count;
}

type RawSanctionRow = {
  id: string;
  student_id: string;
  type: string;
  occurred_at: string;
  description: string;
  title?: string | null;
  author_id: string | null;
  created_at?: string | null;
};

async function mapSanctionRowsToAdminList(
  supabase: SupabaseClient,
  rows: RawSanctionRow[],
): Promise<AdminActiveSanctionRow[]> {
  if (!rows.length) return [];

  const studentIds = [
    ...new Set(rows.map((r) => r.student_id).filter(Boolean)),
  ];
  const { data: studs } = await supabase
    .from("students")
    .select("id,first_name,last_name,class_id")
    .in("id", studentIds);

  const classIds = [
    ...new Set(
      (studs ?? [])
        .map((s) => (s as { class_id?: string | null }).class_id)
        .filter(Boolean) as string[],
    ),
  ];
  const { data: clsRows } =
    classIds.length > 0
      ? await supabase.from("classes").select("id,name").in("id", classIds)
      : { data: [] };

  const classNameById = new Map<string, string>();
  for (const c of clsRows ?? []) {
    classNameById.set(
      (c as { id: string }).id,
      String((c as { name?: string }).name ?? ""),
    );
  }

  const studentMeta = new Map<
    string,
    { fn: string; ln: string; classId: string | null }
  >();
  for (const s of studs ?? []) {
    const id = (s as { id: string }).id;
    studentMeta.set(id, {
      fn: String((s as { first_name?: string }).first_name ?? ""),
      ln: String((s as { last_name?: string }).last_name ?? ""),
      classId: ((s as { class_id?: string | null }).class_id ?? null) as
        | string
        | null,
    });
  }

  return rows.map((r) => {
    const sm = studentMeta.get(r.student_id);
    const cid = sm?.classId ?? null;
    return {
      id: r.id,
      studentId: r.student_id,
      studentFirstName: sm?.fn ?? "",
      studentLastName: sm?.ln ?? "",
      classId: cid,
      className: cid ? (classNameById.get(cid) ?? null) : null,
      type: r.type as SanctionType,
      title: r.title?.trim() ? r.title.trim() : null,
      description: r.description,
      occurredAt: r.occurred_at,
      createdAt: r.created_at ?? r.occurred_at,
      authorId: r.author_id,
    };
  });
}

export async function fetchActiveSanctionsAdminList(): Promise<
  AdminActiveSanctionRow[]
> {
  const supabase = await db();
  if (!supabase) return [];

  const { data: rows, error } = await supabase
    .from("sanctions")
    .select(SANCTION_TABLE_ROW_SELECT)
    .eq("status", "active")
    .order("occurred_at", { ascending: false });

  if (error || !rows?.length) return [];

  return mapSanctionRowsToAdminList(supabase, rows as RawSanctionRow[]);
}

/** Hub sanctions : périmètre selon le rôle (direction = tout, PP = classe titulaire, prof = ses saisies, élève = lui-même). */
export async function fetchActiveSanctionsForViewer(
  user: SessionUser,
): Promise<AdminActiveSanctionRow[]> {
  const supabase = await db();
  if (!supabase) return [];

  const scope = await resolveSanctionsViewerScope(supabase, user);
  if (scope.kind === "none") return [];

  let query = supabase
    .from("sanctions")
    .select(SANCTION_TABLE_ROW_SELECT)
    .eq("status", "active")
    .order("occurred_at", { ascending: false });

  if (scope.kind === "authorOnly") {
    query = query.eq("author_id", scope.authorId);
  } else if (scope.kind === "studentIds") {
    query = query.in("student_id", scope.studentIds);
  }

  const { data: rows, error } = await query;
  if (error || !rows?.length) return [];

  return mapSanctionRowsToAdminList(supabase, rows as RawSanctionRow[]);
}
