import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { SessionUser } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Announcement,
  Sanction,
  SanctionAttachment,
  SanctionType,
  SchoolClass,
  StudentProfile,
} from "@/types";

type ClassRowDb = {
  id: string;
  name: string;
  principal_id: string | null;
  description: string | null;
  academic_year_start: number | null;
  academic_year_end: number | null;
};

const CLASS_SELECT_TRIES = [
  "id,name,description,principal_id,academic_year_start,academic_year_end",
  "id,name,description,principal_id",
  "id,name,principal_id,academic_year_start,academic_year_end",
  "id,name,principal_id",
] as const;

async function loadAllClassRows(
  supabase: SupabaseClient,
): Promise<ClassRowDb[]> {
  for (const sel of CLASS_SELECT_TRIES) {
    const r = await supabase.from("classes").select(sel).order("name");
    if (!r.error && r.data) {
      return (r.data as unknown as ClassRowDb[]).map((c) => ({
        id: c.id,
        name: c.name,
        principal_id: c.principal_id,
        description: (c.description as string | null | undefined) ?? null,
        academic_year_start: (c.academic_year_start as number | null | undefined) ?? null,
        academic_year_end: (c.academic_year_end as number | null | undefined) ?? null,
      }));
    }
  }
  return [];
}

async function loadClassRowById(
  supabase: SupabaseClient,
  classId: string,
): Promise<ClassRowDb | null> {
  for (const sel of CLASS_SELECT_TRIES) {
    const r = await supabase
      .from("classes")
      .select(sel)
      .eq("id", classId)
      .maybeSingle();
    if (!r.error && r.data) {
      const c = r.data as unknown as ClassRowDb;
      return {
        id: c.id,
        name: c.name,
        principal_id: c.principal_id,
        description: (c.description as string | null | undefined) ?? null,
        academic_year_start: (c.academic_year_start as number | null | undefined) ?? null,
        academic_year_end: (c.academic_year_end as number | null | undefined) ?? null,
      };
    }
  }
  return null;
}

const STUDENT_SELECT_TRIES = [
  "id,first_name,last_name,email,photo_url,class_id,entry_date,birth_date,sex,birth_place",
  "id,first_name,last_name,email,photo_url,class_id,entry_date",
] as const;

/** Étudiants d’une classe (client Supabase quelconque : session ou service role). */
export async function fetchStudentsForClassFromClient(
  supabase: SupabaseClient,
  classId: string,
): Promise<StudentProfile[]> {
  for (const sel of STUDENT_SELECT_TRIES) {
    const { data, error } = await supabase
      .from("students")
      .select(sel)
      .eq("class_id", classId)
      .order("last_name");
    if (!error && data) {
      return data.map((r) => mapStudentRow(r as never));
    }
  }
  return [];
}

async function supabaseOrNull() {
  return createServerSupabase();
}

function profileName(
  map: Map<string, { first_name: string; last_name: string }>,
  id: string | null,
): string {
  if (!id) return "—";
  const p = map.get(id);
  if (!p) return "—";
  return `${p.first_name} ${p.last_name}`;
}

export async function countStaffProfiles(): Promise<number> {
  const supabase = await supabaseOrNull();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });
  return error ? 0 : count ?? 0;
}

export async function countStudents(): Promise<number> {
  const supabase = await supabaseOrNull();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true });
  return error ? 0 : count ?? 0;
}

export async function countClasses(): Promise<number> {
  const supabase = await supabaseOrNull();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true });
  return error ? 0 : count ?? 0;
}

export async function countFiles(): Promise<number> {
  const supabase = await supabaseOrNull();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("files")
    .select("id", { count: "exact", head: true });
  return error ? 0 : count ?? 0;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,html,importance,author_id,created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    html: row.html,
    createdAt: row.created_at,
    importance: row.importance === "urgent" ? "urgent" : "normal",
    authorId: row.author_id ?? "",
  }));
}

export type AdminClassOption = {
  id: string;
  name: string;
  academicYearStart: number | null;
  academicYearEnd: number | null;
};

const CLASS_OPTION_SELECT_TRIES = [
  "id,name,academic_year_start,academic_year_end",
  "id,name",
] as const;

type ClassOptionRow = {
  id: string;
  name: string;
  academic_year_start?: number | null;
  academic_year_end?: number | null;
};

/** Liste des classes pour sélecteurs admin : tri par année de début croissante, puis nom. Préfère le service role si disponible. */
export async function fetchAdminClassOptions(): Promise<AdminClassOption[]> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return [];

  let rows: ClassOptionRow[] | null = null;

  for (const sel of CLASS_OPTION_SELECT_TRIES) {
    const r = await supabase.from("classes").select(sel);
    if (!r.error && r.data) {
      rows = r.data as unknown as ClassOptionRow[];
      break;
    }
  }
  if (!rows) return [];

  const mapped: AdminClassOption[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    academicYearStart: (c.academic_year_start as number | null | undefined) ?? null,
    academicYearEnd: (c.academic_year_end as number | null | undefined) ?? null,
  }));

  mapped.sort((a, b) => {
    const ay = a.academicYearStart;
    const by = b.academicYearStart;
    const aNull = ay == null;
    const bNull = by == null;
    if (aNull && bNull) return a.name.localeCompare(b.name, "fr");
    if (aNull) return 1;
    if (bNull) return -1;
    if (ay !== by) return ay - by;
    return a.name.localeCompare(b.name, "fr");
  });

  return mapped;
}

async function buildClassesWithStudentsFromClient(
  supabase: SupabaseClient,
): Promise<SchoolClass[]> {
  const classes = await loadAllClassRows(supabase);
  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id,class_id");
  const byClass = new Map<string, string[]>();
  if (!sErr && students) {
    for (const s of students) {
      if (!s.class_id) continue;
      const list = byClass.get(s.class_id) ?? [];
      list.push(s.id);
      byClass.set(s.class_id, list);
    }
  }
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    academicYearStart: c.academic_year_start ?? null,
    academicYearEnd: c.academic_year_end ?? null,
    principalId: c.principal_id ?? undefined,
    studentIds: byClass.get(c.id) ?? [],
  }));
}

export async function fetchClassesWithStudents(): Promise<SchoolClass[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  return buildClassesWithStudentsFromClient(supabase);
}

/** Liste classes + effectifs : préfère le client service role (contourne RLS) si configuré. */
export async function fetchClassesWithStudentsForAdmin(): Promise<SchoolClass[]> {
  const admin = createAdminSupabase();
  const sessionClient = await supabaseOrNull();
  const supabase = admin ?? sessionClient;
  if (!supabase) return [];
  return buildClassesWithStudentsFromClient(supabase);
}

export async function fetchClassById(
  id: string,
): Promise<SchoolClass | null> {
  const all = await fetchClassesWithStudents();
  return all.find((c) => c.id === id) ?? null;
}

export async function fetchStudentsForClass(
  classId: string,
): Promise<StudentProfile[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  return fetchStudentsForClassFromClient(supabase, classId);
}

export type ClassAdminDetail = {
  id: string;
  name: string;
  description: string | null;
  academicYearStart: number | null;
  academicYearEnd: number | null;
  principalId: string | null;
  principal: { id: string; firstName: string; lastName: string } | null;
  students: StudentProfile[];
};

export type ClassPrincipalOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export { formatAcademicYearRange } from "@/lib/academic-year-display";

async function fetchClassAdminDetailFromClient(
  supabase: SupabaseClient,
  classId: string,
): Promise<ClassAdminDetail | null> {
  const row = await loadClassRowById(supabase, classId);
  if (!row) return null;

  const students = await fetchStudentsForClassFromClient(supabase, classId);

  let principal: ClassAdminDetail["principal"] = null;
  if (row.principal_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id,first_name,last_name")
      .eq("id", row.principal_id)
      .maybeSingle();
    if (p) {
      principal = {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
      };
    }
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    academicYearStart: row.academic_year_start,
    academicYearEnd: row.academic_year_end,
    principalId: row.principal_id,
    principal,
    students,
  };
}

export async function fetchClassAdminDetail(
  classId: string,
): Promise<ClassAdminDetail | null> {
  const supabase = await supabaseOrNull();
  if (!supabase) return null;
  return fetchClassAdminDetailFromClient(supabase, classId);
}

/** Fiche classe admin : préfère le client service role si configuré (évite 404 si RLS bloque la lecture). */
export async function fetchClassAdminDetailForAdmin(
  classId: string,
): Promise<ClassAdminDetail | null> {
  const admin = createAdminSupabase();
  const sessionClient = await supabaseOrNull();
  const supabase = admin ?? sessionClient;
  if (!supabase) return null;
  return fetchClassAdminDetailFromClient(supabase, classId);
}

/** Profil intervenants pouvant être désignés professeur principal de classe. */
export async function fetchEligiblePrincipalsForClasses(): Promise<
  ClassPrincipalOption[]
> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .in("base_role", ["PROFESSEUR", "PROF_PRINCIPAL"])
    .order("last_name");
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
  }));
}

export function mapStudentRow(row: {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  class_id: string | null;
  entry_date: string | null;
  birth_date?: string | null;
  sex?: string | null;
  birth_place?: string | null;
}): StudentProfile {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    classId: row.class_id ?? "",
    entryDate: row.entry_date ?? undefined,
    birthDate: row.birth_date ?? null,
    sex: row.sex ?? null,
    birthPlace: row.birth_place ?? null,
  };
}

export async function fetchStudentById(
  id: string,
): Promise<StudentProfile | null> {
  const supabase = await supabaseOrNull();
  if (!supabase) return null;
  for (const sel of STUDENT_SELECT_TRIES) {
    const { data, error } = await supabase
      .from("students")
      .select(sel)
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      return mapStudentRow(data as unknown as Parameters<typeof mapStudentRow>[0]);
    }
  }
  return null;
}

export async function fetchProfileById(
  id: string,
): Promise<{ firstName: string; lastName: string } | null> {
  const supabase = await supabaseOrNull();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name,last_name")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return { firstName: data.first_name, lastName: data.last_name };
}

async function loadProfileMap(
  ids: (string | null)[],
): Promise<Map<string, { first_name: string; last_name: string }>> {
  const supabase = await supabaseOrNull();
  const map = new Map<string, { first_name: string; last_name: string }>();
  const clean = [...new Set(ids.filter(Boolean) as string[])];
  if (!supabase || clean.length === 0) return map;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .in("id", clean);
  if (error || !data) return map;
  for (const p of data) {
    map.set(p.id, { first_name: p.first_name, last_name: p.last_name });
  }
  return map;
}

async function loadAttachmentsForSanctions(
  sanctionIds: string[],
): Promise<Map<string, SanctionAttachment[]>> {
  const result = new Map<string, SanctionAttachment[]>();
  const supabase = await supabaseOrNull();
  if (!supabase || sanctionIds.length === 0) return result;
  const { data, error } = await supabase
    .from("sanction_attachments")
    .select("id,sanction_id,file_path")
    .in("sanction_id", sanctionIds);
  if (error || !data) return result;
  for (const row of data) {
    const list = result.get(row.sanction_id) ?? [];
    list.push({
      id: row.id,
      url: row.file_path,
      name: row.file_path.split("/").pop(),
    });
    result.set(row.sanction_id, list);
  }
  return result;
}

function mapSanctionDbToApp(
  row: {
    id: string;
    student_id: string;
    type: string;
    occurred_at: string;
    description: string;
    author_id: string | null;
    status: string;
    retired_at: string | null;
    retired_by: string | null;
    pdf_path: string | null;
  },
  profileMap: Map<string, { first_name: string; last_name: string }>,
  attachments: SanctionAttachment[],
): Sanction {
  return {
    id: row.id,
    studentId: row.student_id,
    type: row.type as SanctionType,
    date: row.occurred_at,
    description: row.description,
    authorId: row.author_id ?? "",
    authorName: profileName(profileMap, row.author_id),
    status: row.status === "retired" ? "retired" : "active",
    retiredAt: row.retired_at ?? undefined,
    retiredById: row.retired_by ?? undefined,
    retiredByName:
      row.retired_by === null
        ? undefined
        : profileName(profileMap, row.retired_by),
    attachments,
    pdfUrl: row.pdf_path ?? undefined,
  };
}

export async function fetchSanctionById(id: string): Promise<Sanction | null> {
  const supabase = await supabaseOrNull();
  if (!supabase) return null;
  const { data: row, error } = await supabase
    .from("sanctions")
    .select(
      "id,student_id,type,occurred_at,description,author_id,status,retired_at,retired_by,pdf_path",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return null;
  const profileMap = await loadProfileMap([row.author_id, row.retired_by]);
  const attMap = await loadAttachmentsForSanctions([row.id]);
  return mapSanctionDbToApp(row, profileMap, attMap.get(row.id) ?? []);
}

export async function fetchSanRawById(id: string): Promise<{
  sanction: Sanction;
  student: StudentProfile;
} | null> {
  const sanction = await fetchSanctionById(id);
  if (!sanction) return null;
  const student = await fetchStudentById(sanction.studentId);
  if (!student) return null;
  return { sanction, student };
}

export async function fetchSanctionsForStudent(
  studentId: string,
): Promise<Sanction[]> {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from("sanctions")
    .select(
      "id,student_id,type,occurred_at,description,author_id,status,retired_at,retired_by,pdf_path",
    )
    .eq("student_id", studentId)
    .order("occurred_at", { ascending: false });
  if (error || !rows?.length) return [];
  const ids = rows.map((r) => r.id);
  const profileMap = await loadProfileMap(
    rows.flatMap((r) => [r.author_id, r.retired_by]),
  );
  const attMap = await loadAttachmentsForSanctions(ids);
  return rows.map((r) =>
    mapSanctionDbToApp(r, profileMap, attMap.get(r.id) ?? []),
  );
}

export async function fetchRecentSanctionsRows(limit: number) {
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from("sanctions")
    .select(
      "id,student_id,type,occurred_at,description,author_id,status,retired_at,retired_by,pdf_path",
    )
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error || !rows) return [];
  const ids = rows.map((r) => r.id);
  const profileMap = await loadProfileMap(
    rows.flatMap((r) => [r.author_id, r.retired_by]),
  );
  const attMap = await loadAttachmentsForSanctions(ids);
  return rows.map((r) =>
    mapSanctionDbToApp(r, profileMap, attMap.get(r.id) ?? []),
  );
}

export async function fetchRecentSanctionsForUser(
  user: SessionUser,
  limit: number,
): Promise<Sanction[]> {
  const rows = await fetchRecentSanctionsRows(Math.max(limit * 4, 32));
  if (user.role !== "PROF_PRINCIPAL") {
    return rows.slice(0, limit);
  }
  const scope = new Set(user.principalClassIds ?? []);
  if (scope.size === 0) return [];
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  if (studentIds.length === 0) return [];
  const { data: students, error } = await supabase
    .from("students")
    .select("id,class_id")
    .in("id", studentIds);
  if (error || !students) return [];
  const classByStudent = new Map(students.map((s) => [s.id, s.class_id]));
  const filtered = rows.filter((r) => {
    const cid = classByStudent.get(r.studentId);
    return cid && scope.has(cid);
  });
  return filtered.slice(0, limit);
}

export async function fetchSanctionsForClassStudents(
  studentIds: string[],
  previewLimit: number,
): Promise<Sanction[]> {
  if (studentIds.length === 0) return [];
  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  const { data: rows, error } = await supabase
    .from("sanctions")
    .select(
      "id,student_id,type,occurred_at,description,author_id,status,retired_at,retired_by,pdf_path",
    )
    .in("student_id", studentIds)
    .order("occurred_at", { ascending: false })
    .limit(previewLimit);
  if (error || !rows) return [];
  const ids = rows.map((r) => r.id);
  const profileMap = await loadProfileMap(
    rows.flatMap((r) => [r.author_id, r.retired_by]),
  );
  const attMap = await loadAttachmentsForSanctions(ids);
  return rows.map((r) =>
    mapSanctionDbToApp(r, profileMap, attMap.get(r.id) ?? []),
  );
}
