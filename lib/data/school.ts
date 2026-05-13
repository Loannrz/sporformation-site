import { hasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { SessionUser } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  viewerSeesAnnouncement,
  normalizeAnnouncementAudience,
} from "@/lib/announcement-audience";
import { normalizeAnnouncementAccent } from "@/lib/announcement-accents";
import { normalizeAnnouncementLogoId } from "@/lib/announcement-logos";
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

/**
 * Personnel connecté / intranet — préfère `service_role` si disponible (évite liste vide lorsque les RLS
 * filtrent trop fort), sinon client session.
 */
async function staffReadSupabase(): Promise<SupabaseClient | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = createAdminSupabase();
  return admin ?? (await supabaseOrNull());
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

async function fetchAnnouncementsWithClient(
  supabase: SupabaseClient,
): Promise<Announcement[]> {
  const sel =
    "id,title,html,importance,author_id,created_at,audience,logo_key,accent";
  let { data, error } = await supabase
    .from("announcements")
    .select(sel)
    .order("created_at", { ascending: false });

  if (error) {
    const fbAudience = await supabase
      .from("announcements")
      .select(
        "id,title,html,importance,author_id,created_at,audience,logo_key",
      )
      .order("created_at", { ascending: false });
    data = fbAudience.data as typeof data;
    error = fbAudience.error as typeof error;
  }

  if (error) {
    const fallback = await supabase
      .from("announcements")
      .select("id,title,html,importance,author_id,created_at")
      .order("created_at", { ascending: false });
    data = fallback.data as typeof data;
    error = fallback.error as typeof error;
  }

  if (error || !data) return [];

  const rows = data as unknown as {
    id: string;
    title: string;
    html: string;
    importance?: string | null;
    author_id?: string | null;
    created_at: string;
    audience?: string | null;
    logo_key?: string | null;
    accent?: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    html: row.html,
    createdAt: row.created_at,
    importance: row.importance === "urgent" ? "urgent" : "normal",
    authorId: row.author_id ?? "",
    audience: normalizeAnnouncementAudience(row.audience ?? undefined),
    logoKey: normalizeAnnouncementLogoId(row.logo_key),
    accentKey: normalizeAnnouncementAccent(row.accent ?? undefined),
  }));
}

/**
 * Annonces en base pour l’interface (après connexion).
 * Les insertions utilisent le service_role ; sans la même lecture, une RLS mal alignée
 * renvoie souvent 0 ligne sans erreur. On lit donc avec le service_role côté serveur
 * lorsqu’il est configuré, tout en exigeant une session valide.
 */
export async function fetchAnnouncements(): Promise<Announcement[]> {
  const user = await getSessionUser();
  if (!user) return [];

  const admin = createAdminSupabase();
  if (admin) {
    return fetchAnnouncementsWithClient(admin);
  }

  const supabase = await supabaseOrNull();
  if (!supabase) return [];
  return fetchAnnouncementsWithClient(supabase);
}

/** Annonces visibles sur le tableau de bord : filtrage par audience, sauf pour qui peut publier (direction / admin) qui voit tout le flux. */
export async function fetchAnnouncementsForUser(
  user: SessionUser,
): Promise<Announcement[]> {
  const rows = await fetchAnnouncements();
  if (hasPermission(user, "CREATE_ANNOUNCEMENTS")) {
    return rows;
  }
  return rows.filter((a) => viewerSeesAnnouncement(user.role, a.audience));
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
  const supabase = await staffReadSupabase();
  if (!supabase) return [];
  return buildClassesWithStudentsFromClient(supabase);
}

/** Données pour le raccourci « Avertissement » (sélecteurs élève / classe). */
export type DisciplineDialogOptions = {
  classes: { id: string; name: string }[];
  students: {
    id: string;
    firstName: string;
    lastName: string;
    classId: string | null;
    className: string | null;
  }[];
};

export async function fetchDisciplineDialogOptions(): Promise<DisciplineDialogOptions> {
  const supabase = await staffReadSupabase();
  if (!supabase) return { classes: [], students: [] };

  const classRows = await loadAllClassRows(supabase);
  const nameByClassId = new Map(classRows.map((c) => [c.id, c.name]));

  for (const sel of STUDENT_SELECT_TRIES) {
    const { data, error } = await supabase
      .from("students")
      .select(sel)
      .order("last_name");
    if (!error && data) {
      const students = (data as { id: string; class_id: string | null }[]).map(
        (r) => {
          const row = r as {
            id: string;
            first_name: string;
            last_name: string;
            class_id: string | null;
          };
          const cid = row.class_id;
          return {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            classId: cid,
            className: cid ? (nameByClassId.get(cid) ?? null) : null,
          };
        },
      );
      return {
        classes: classRows.map((c) => ({ id: c.id, name: c.name })),
        students,
      };
    }
  }

  return {
    classes: classRows.map((c) => ({ id: c.id, name: c.name })),
    students: [],
  };
}

/** Carte liste classes : données alignées lecture staff (voir `staffReadSupabase`). */
export type StaffClassCard = SchoolClass & {
  principalDisplay: string | null;
  /** Sanctions encore actives dans la classe. */
  activeSanctionsCount: number;
};

export async function fetchStaffClassesOverview(): Promise<StaffClassCard[]> {
  const supabase = await staffReadSupabase();
  if (!supabase) return [];
  const classes = await buildClassesWithStudentsFromClient(supabase);
  const principalIds = classes
    .map((c) => c.principalId)
    .filter(Boolean) as string[];
  const pmap =
    principalIds.length > 0
      ? await loadProfileMap(principalIds, supabase)
      : new Map<
          string,
          { first_name: string; last_name: string }
        >();

  const principalDisplay = (pid?: string): string | null => {
    if (!pid) return null;
    const p = pmap.get(pid);
    if (!p) return null;
    return `${p.first_name} ${p.last_name}`.trim() || null;
  };

  const allStudentIds = [...new Set(classes.flatMap((c) => c.studentIds))];
  const totalBySid = new Map<string, number>();
  if (allStudentIds.length) {
    const { data: sanctionRows } = await supabase
      .from("sanctions")
      .select("student_id")
      .eq("status", "active")
      .in("student_id", allStudentIds);
    for (const row of sanctionRows ?? []) {
      const sid = row.student_id as string;
      totalBySid.set(sid, (totalBySid.get(sid) ?? 0) + 1);
    }
  }

  return classes.map((c) => ({
    ...c,
    principalDisplay: principalDisplay(c.principalId),
    activeSanctionsCount: c.studentIds.reduce(
      (acc, sid) => acc + (totalBySid.get(sid) ?? 0),
      0,
    ),
  }));
}

export async function countActiveSanctionsForStudents(
  studentIds: string[],
): Promise<number> {
  if (studentIds.length === 0) return 0;
  const supabase = await staffReadSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("sanctions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .in("student_id", studentIds);
  if (error || count == null) return 0;
  return count;
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
  const supabase = await staffReadSupabase();
  if (!supabase) return null;
  const row = await loadClassRowById(supabase, id);
  if (!row) return null;
  const { data: studs, error } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", id);
  const studentIds = !error && studs ? studs.map((s) => s.id as string) : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    academicYearStart: row.academic_year_start ?? null,
    academicYearEnd: row.academic_year_end ?? null,
    principalId: row.principal_id ?? undefined,
    studentIds,
  };
}

export async function fetchStudentsForClass(
  classId: string,
): Promise<StudentProfile[]> {
  const supabase = await staffReadSupabase();
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

/** Profils enseignants pouvant être désignés professeur principal de classe. */
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
  const supabase = await staffReadSupabase();
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
  const supabase = await staffReadSupabase();
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
  client?: SupabaseClient | null,
): Promise<Map<string, { first_name: string; last_name: string }>> {
  const supabase = client ?? (await supabaseOrNull());
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
  client?: SupabaseClient | null,
): Promise<Map<string, SanctionAttachment[]>> {
  const result = new Map<string, SanctionAttachment[]>();
  const supabase = client ?? (await supabaseOrNull());
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
  const supabase = await staffReadSupabase();
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
    supabase,
  );
  const attMap = await loadAttachmentsForSanctions(ids, supabase);
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
  const supabase = await staffReadSupabase();
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
    supabase,
  );
  const attMap = await loadAttachmentsForSanctions(ids, supabase);
  return rows.map((r) =>
    mapSanctionDbToApp(r, profileMap, attMap.get(r.id) ?? []),
  );
}

export function formatCloudClassDisplayName(
  name: string,
  academicYearStart: number | null,
  academicYearEnd: number | null,
): string {
  const y0 = academicYearStart;
  const y1 = academicYearEnd;
  if (
    y0 != null &&
    y1 != null &&
    Number.isFinite(y0) &&
    Number.isFinite(y1)
  ) {
    return `${name} – ${y0}–${y1}`;
  }
  return name;
}

/** Cycle considéré comme terminé si `academicYearEnd` &lt; année civile courante. */
export function cloudClassIsPastCycle(academicYearEnd: number | null): boolean {
  if (academicYearEnd == null || !Number.isFinite(academicYearEnd)) {
    return false;
  }
  const y = new Date().getFullYear();
  return academicYearEnd < y;
}

/**
 * La classe est comptée pour l’année civile `year` si l’intervalle [début, fin] la contient
 * (bornes nulles = pas de limite de ce côté).
 */
export function classActiveForCalendarYear(
  academicYearStart: number | null,
  academicYearEnd: number | null,
  year: number,
): boolean {
  const s =
    academicYearStart != null && Number.isFinite(academicYearStart)
      ? academicYearStart
      : null;
  const e =
    academicYearEnd != null && Number.isFinite(academicYearEnd)
      ? academicYearEnd
      : null;
  if (s != null && s > year) return false;
  if (e != null && e < year) return false;
  return true;
}

export type DashboardDirectorStats = {
  /** Profils « staff » comme dans l’explorateur Cloud (prof., PP, direction, admin.). */
  teacherStaffCount: number;
  studentCount: number;
  /** Classes dont le cycle recouvre l’année civile courante. */
  activeClassCount: number;
  fileCount: number;
};

/**
 * Totaux tableau de bord direction : service_role si dispo, sinon session (peut rester partiel sous RLS).
 */
export async function fetchDashboardDirectorStats(): Promise<DashboardDirectorStats> {
  const empty: DashboardDirectorStats = {
    teacherStaffCount: 0,
    studentCount: 0,
    activeClassCount: 0,
    fileCount: 0,
  };
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return empty;

  const year = new Date().getFullYear();

  const [profRes, studRes, filesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or(
        "base_role.eq.PROFESSEUR,base_role.eq.PROF_PRINCIPAL,base_role.eq.DIRECTEUR,base_role.eq.ADMINISTRATEUR",
      ),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("files").select("id", { count: "exact", head: true }),
  ]);

  const classRows = await loadAllClassRows(supabase);
  const activeClassCount = classRows.filter((c) =>
    classActiveForCalendarYear(
      c.academic_year_start,
      c.academic_year_end,
      year,
    ),
  ).length;

  return {
    teacherStaffCount: profRes.error ? 0 : profRes.count ?? 0,
    studentCount: studRes.error ? 0 : studRes.count ?? 0,
    activeClassCount,
    fileCount: filesRes.error ? 0 : filesRes.count ?? 0,
  };
}

export type CloudExplorerClassFolder = {
  id: string;
  /** Libellé affiché : « Nom – début–fin » lorsque les années sont renseignées. */
  displayLabel: string;
  documentCount: number;
  academicYearStart: number | null;
  academicYearEnd: number | null;
  /** true si l’année de fin de cycle est strictement avant l’année civile courante. */
  isPastCycle: boolean;
};

export type CloudExplorerTeacherFolder = {
  id: string;
  displayName: string;
  documentCount: number;
};

export type CloudExplorerStudentFolder = {
  id: string;
  displayName: string;
  /** Libellé de la classe de l’élève. */
  classLabel: string | null;
  documentCount: number;
};

/** Option élève pour le formulaire d’upload (nom + classe). */
export type CloudStudentUploadOption = {
  id: string;
  label: string;
  classId: string | null;
};

export async function fetchCloudStudentUploadOptions(): Promise<
  CloudStudentUploadOption[]
> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return [];

  const classRows = await loadAllClassRows(supabase);
  const classLabelById = new Map(
    classRows.map((c) => [
      c.id,
      formatCloudClassDisplayName(
        c.name,
        c.academic_year_start,
        c.academic_year_end,
      ),
    ]),
  );

  const { data, error } = await supabase
    .from("students")
    .select("id,first_name,last_name,class_id")
    .order("last_name");

  if (error || !data) return [];

  return (data as { id: string; first_name: string; last_name: string; class_id: string | null }[]).map(
    (s) => {
      const name = `${s.first_name} ${s.last_name}`.trim() || "—";
      const cid = s.class_id;
      const cl = cid ? classLabelById.get(cid) ?? null : null;
      const label = cl ? `${name} · ${cl}` : name;
      return { id: s.id, label, classId: cid };
    },
  );
}

/** Classe d’un élève (pré-sélection upload depuis un dossier élève). */
export async function fetchStudentClassIdForCloud(
  studentId: string,
): Promise<string | null> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return null;
  const { data } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .maybeSingle();
  return (data?.class_id as string | null | undefined) ?? null;
}

/**
 * Dossiers Cloud : classes, professeurs, élèves + comptages fichiers.
 */
export async function fetchCloudExplorerFolders(): Promise<{
  classes: CloudExplorerClassFolder[];
  teachers: CloudExplorerTeacherFolder[];
  students: CloudExplorerStudentFolder[];
}> {
  const empty = {
    classes: [] as CloudExplorerClassFolder[],
    teachers: [] as CloudExplorerTeacherFolder[],
    students: [] as CloudExplorerStudentFolder[],
  };
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return empty;

  const classRows = await loadAllClassRows(supabase);

  const { data: profRows, error: profErr } = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .or(
      "base_role.eq.PROFESSEUR,base_role.eq.PROF_PRINCIPAL,base_role.eq.DIRECTEUR,base_role.eq.ADMINISTRATEUR",
    )
    .order("last_name");

  const { data: studRows, error: studErr } = await supabase
    .from("students")
    .select("id,first_name,last_name,class_id")
    .order("last_name");

  const { data: fileRows, error: filesErr } = await supabase
    .from("files")
    .select("class_id,owner_id,student_id");

  const classLabelById = new Map(
    classRows.map((c) => [
      c.id,
      formatCloudClassDisplayName(
        c.name,
        c.academic_year_start,
        c.academic_year_end,
      ),
    ]),
  );

  const classCounts = new Map<string, number>();
  const ownerCounts = new Map<string, number>();
  const studentCounts = new Map<string, number>();
  if (!filesErr && fileRows) {
    for (const f of fileRows) {
      const cid = f.class_id as string | null;
      if (cid) {
        classCounts.set(cid, (classCounts.get(cid) ?? 0) + 1);
      }
      const oid = f.owner_id as string | null;
      if (oid) {
        ownerCounts.set(oid, (ownerCounts.get(oid) ?? 0) + 1);
      }
      const sid = f.student_id as string | null | undefined;
      if (sid) {
        studentCounts.set(sid, (studentCounts.get(sid) ?? 0) + 1);
      }
    }
  }

  const classes: CloudExplorerClassFolder[] = classRows.map((c) => ({
    id: c.id,
    displayLabel: formatCloudClassDisplayName(
      c.name,
      c.academic_year_start,
      c.academic_year_end,
    ),
    documentCount: classCounts.get(c.id) ?? 0,
    academicYearStart: c.academic_year_start,
    academicYearEnd: c.academic_year_end,
    isPastCycle: cloudClassIsPastCycle(c.academic_year_end),
  }));

  let teachers: CloudExplorerTeacherFolder[] = [];
  if (!profErr && profRows) {
    teachers = profRows.map((p) => ({
      id: p.id,
      displayName: `${p.first_name} ${p.last_name}`.trim() || "—",
      documentCount: ownerCounts.get(p.id) ?? 0,
    }));
  }

  let students: CloudExplorerStudentFolder[] = [];
  if (!studErr && studRows) {
    students = (
      studRows as {
        id: string;
        first_name: string;
        last_name: string;
        class_id: string | null;
      }[]
    ).map((s) => {
      const cid = s.class_id;
      return {
        id: s.id,
        displayName: `${s.first_name} ${s.last_name}`.trim() || "—",
        classLabel: cid ? classLabelById.get(cid) ?? null : null,
        documentCount: studentCounts.get(s.id) ?? 0,
      };
    });
  }

  return { classes, teachers, students };
}

/**
 * Titre affiché sur la page dossier Cloud (classe, professeur ou élève).
 */
export async function resolveCloudFolderHeading(
  dossierParam: string,
): Promise<{ title: string }> {
  const slug = decodeURIComponent(dossierParam);
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  const fallback = { title: slug };

  if (!supabase) return fallback;

  if (slug.startsWith("classe-")) {
    const id = slug.slice("classe-".length);
    const row = await loadClassRowById(supabase, id);
    if (!row) return fallback;
    return {
      title: formatCloudClassDisplayName(
        row.name,
        row.academic_year_start,
        row.academic_year_end,
      ),
    };
  }

  if (slug.startsWith("prof-")) {
    const id = slug.slice("prof-".length);
    const { data } = await supabase
      .from("profiles")
      .select("first_name,last_name")
      .eq("id", id)
      .maybeSingle();
    if (!data) return fallback;
    const name = `${data.first_name} ${data.last_name}`.trim();
    return { title: name || slug };
  }

  if (slug.startsWith("eleve-")) {
    const id = slug.slice("eleve-".length);
    const { data } = await supabase
      .from("students")
      .select("first_name,last_name")
      .eq("id", id)
      .maybeSingle();
    if (!data) return fallback;
    const name = `${data.first_name} ${data.last_name}`.trim();
    return { title: name || slug };
  }

  return fallback;
}

export type CloudFolderSlugParsed =
  | { kind: "class"; id: string }
  | { kind: "teacher"; id: string }
  | { kind: "student"; id: string };

export function parseCloudFolderSlug(
  dossierParam: string,
): CloudFolderSlugParsed | null {
  const slug = decodeURIComponent(dossierParam);
  if (slug.startsWith("classe-")) {
    const id = slug.slice("classe-".length);
    if (!id) return null;
    return { kind: "class", id };
  }
  if (slug.startsWith("prof-")) {
    const id = slug.slice("prof-".length);
    if (!id) return null;
    return { kind: "teacher", id };
  }
  if (slug.startsWith("eleve-")) {
    const id = slug.slice("eleve-".length);
    if (!id) return null;
    return { kind: "student", id };
  }
  return null;
}

export type CloudFolderFileRow = {
  id: string;
  title: string;
  description: string;
  mime: string | null;
  createdAt: string;
  version: number;
  /** Classe associée au fichier (nullable). */
  classId: string | null;
  /** Professeur ou auteur du dépôt (auth user id). */
  ownerId: string | null;
  /** Élève associé au fichier (nullable). */
  studentId: string | null;
  /** Chemin dans le bucket `documents` pour la version affichée. */
  storagePath: string | null;
};

export type CloudFolderFileWithUrl = CloudFolderFileRow & {
  signedUrl: string | null;
};

/** Métadonnées classe / professeur / élève pour la vue « tous les documents » du Cloud. */
export type CloudExplorerFileRow = CloudFolderFileRow & {
  /** Libellé classe formaté ; null si aucune classe liée. */
  classLabel: string | null;
  /** Nom affiché du professeur déposant ; null si inconnu ou non lié. */
  teacherName: string | null;
  /** Nom de l’élève concerné ; null si aucun. */
  studentName: string | null;
};

export type CloudExplorerFileWithUrl = CloudExplorerFileRow & {
  signedUrl: string | null;
};

/** Fichiers liés à un dossier Cloud (classe, professeur ou élève). */
export async function fetchCloudFolderFiles(
  kind: "class" | "teacher" | "student",
  entityId: string,
): Promise<CloudFolderFileRow[]> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return [];

  const fullSelect =
    "id,title,description,logical_key,mime,created_at,class_id,owner_id,student_id";
  const legacySelect =
    "id,logical_key,mime,created_at,class_id,owner_id";

  const col =
    kind === "class"
      ? "class_id"
      : kind === "teacher"
        ? "owner_id"
        : "student_id";

  const run = (sel: string) =>
    supabase.from("files").select(sel).eq(col, entityId).order("created_at", {
      ascending: false,
    });

  let res = await run(fullSelect);
  if (res.error) {
    if (kind === "student") {
      return [];
    }
    res = await run(legacySelect);
  }

  const { data, error } = res;
  if (error || !data?.length) return [];

  const rows = data as unknown as {
    id: string;
    logical_key?: string | null;
    mime?: string | null;
    created_at?: string | null;
    title?: string | null;
    description?: string | null;
    class_id?: string | null;
    owner_id?: string | null;
    student_id?: string | null;
  }[];

  const ids = rows.map((f) => f.id);
  const { data: vers } = await supabase
    .from("file_versions")
    .select("file_id,version,storage_path")
    .in("file_id", ids);

  const latest = new Map<string, { version: number; storagePath: string }>();
  for (const v of vers ?? []) {
    const fid = v.file_id as string;
    const ver = Number(v.version);
    const storagePath = String(v.storage_path ?? "");
    const cur = latest.get(fid);
    if (!cur || ver > cur.version) {
      latest.set(fid, {
        version: ver,
        storagePath: storagePath || (cur?.storagePath ?? ""),
      });
    }
  }

  return rows.map((f) => {
    const id = f.id;
    const titleRaw = f.title?.trim();
    const logicalKey = String(f.logical_key ?? "");
    const lv = latest.get(id);
    return {
      id,
      title: titleRaw || logicalKey,
      description: String(f.description ?? ""),
      mime: f.mime ?? null,
      createdAt: String(f.created_at ?? ""),
      version: lv?.version ?? 1,
      classId: f.class_id ?? null,
      ownerId: f.owner_id ?? null,
      studentId: f.student_id ?? null,
      storagePath: lv?.storagePath || null,
    };
  });
}

/**
 * Tous les fichiers Cloud avec libellés classe et professeur (explorateur racine).
 */
export async function fetchAllCloudExplorerFiles(): Promise<CloudExplorerFileRow[]> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return [];

  const classRows = await loadAllClassRows(supabase);
  const classLabelById = new Map(
    classRows.map((c) => [
      c.id,
      formatCloudClassDisplayName(
        c.name,
        c.academic_year_start,
        c.academic_year_end,
      ),
    ]),
  );

  const fullSelect =
    "id,title,description,logical_key,mime,created_at,class_id,owner_id,student_id";
  const legacySelect = "id,logical_key,mime,created_at,class_id,owner_id";

  type FileRowAll = {
    id: string;
    class_id?: string | null;
    owner_id?: string | null;
    student_id?: string | null;
    logical_key?: string | null;
    mime?: string | null;
    created_at?: string | null;
    title?: string | null;
    description?: string | null;
  };

  const attemptFull = await supabase
    .from("files")
    .select(fullSelect)
    .order("created_at", { ascending: false });

  const attempt = attemptFull.error
    ? await supabase
        .from("files")
        .select(legacySelect)
        .order("created_at", { ascending: false })
    : attemptFull;

  const data = attempt.data as FileRowAll[] | null;
  const error = attempt.error;

  if (error || !data?.length) return [];

  const rows = data;

  const ownerIds = [
    ...new Set(
      rows
        .map((f) => f.owner_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const teacherNameById = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,first_name,last_name")
      .in("id", ownerIds);
    for (const p of profs ?? []) {
      const name = `${p.first_name} ${p.last_name}`.trim();
      teacherNameById.set(p.id as string, name || "—");
    }
  }

  const studentIds = [
    ...new Set(
      rows
        .map((f) => f.student_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const studentNameById = new Map<string, string>();
  if (studentIds.length > 0) {
    const { data: studs } = await supabase
      .from("students")
      .select("id,first_name,last_name")
      .in("id", studentIds);
    for (const s of studs ?? []) {
      const name = `${s.first_name} ${s.last_name}`.trim();
      studentNameById.set(s.id as string, name || "—");
    }
  }

  const ids = rows.map((f) => f.id);
  const { data: vers } = await supabase
    .from("file_versions")
    .select("file_id,version,storage_path")
    .in("file_id", ids);

  const latest = new Map<string, { version: number; storagePath: string }>();
  for (const v of vers ?? []) {
    const fid = v.file_id as string;
    const ver = Number(v.version);
    const storagePath = String(v.storage_path ?? "");
    const cur = latest.get(fid);
    if (!cur || ver > cur.version) {
      latest.set(fid, {
        version: ver,
        storagePath: storagePath || (cur?.storagePath ?? ""),
      });
    }
  }

  return rows.map((f) => {
    const id = f.id;
    const titleRaw = f.title?.trim();
    const logicalKey = String(f.logical_key ?? "");
    const lv = latest.get(id);
    const cid = (f.class_id as string | null | undefined) ?? null;
    const oid = (f.owner_id as string | null | undefined) ?? null;
    const sid = (f.student_id as string | null | undefined) ?? null;
    return {
      id,
      title: titleRaw || logicalKey,
      description: String(f.description ?? ""),
      mime: f.mime ?? null,
      createdAt: String(f.created_at ?? ""),
      version: lv?.version ?? 1,
      storagePath: lv?.storagePath || null,
      classId: cid,
      ownerId: oid,
      studentId: sid,
      classLabel: cid ? classLabelById.get(cid) ?? null : null,
      teacherName: oid ? teacherNameById.get(oid) ?? null : null,
      studentName: sid ? studentNameById.get(sid) ?? null : null,
    };
  });
}

const CLOUD_DOCUMENTS_BUCKET = "documents";

/** URL signée (lecture) pour chaque fichier ; null si pas de chemin ou erreur Storage. */
export async function attachSignedUrlsToCloudFiles<T extends CloudFolderFileRow>(
  files: T[],
): Promise<Array<T & { signedUrl: string | null }>> {
  const admin = createAdminSupabase();
  if (!admin || files.length === 0) {
    return files.map((f) => ({ ...f, signedUrl: null }));
  }

  const out: Array<T & { signedUrl: string | null }> = [];
  for (const f of files) {
    if (!f.storagePath) {
      out.push({ ...f, signedUrl: null });
      continue;
    }
    const { data, error } = await admin.storage
      .from(CLOUD_DOCUMENTS_BUCKET)
      .createSignedUrl(f.storagePath, 3600);
    out.push({
      ...f,
      signedUrl: !error && data?.signedUrl ? data.signedUrl : null,
    });
  }
  return out;
}
