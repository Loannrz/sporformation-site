import { hasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CloudDocumentAudience } from "@/lib/cloud-document-audience";
import {
  normalizeCloudDocumentAudience,
  viewerSeesCloudDocumentAudience,
} from "@/lib/cloud-document-audience";
import type { SessionUser, UserRole } from "@/types";
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
import {
  STUDENT_INBOX_FOLDER_KIND,
  getStudentInboxFolderId as getStudentInboxFolderIdPure,
} from "@/lib/cloud/class-cloud-folder-helpers";
import { formatCloudClassDisplayName as formatCloudClassDisplayNamePure } from "@/lib/format-cloud-class-display-name";
import { SANCTION_TABLE_ROW_SELECT } from "@/lib/sanction-columns";
import { resolveSanctionsViewerScope } from "@/lib/sanctions-viewer-scope";

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

import {
  STUDENT_FULL_SELECT,
  STUDENT_BASE_SELECT,
} from "@/lib/students-extended-fields";

const STUDENT_SELECT_TRIES = [
  STUDENT_FULL_SELECT,
  STUDENT_BASE_SELECT,
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

/** Annonces visibles sur le tableau de bord : filtrage par audience, sauf direction / admin (flux complet pour modération). */
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
      const students = (
        data as unknown as {
          id: string;
          first_name: string;
          last_name: string;
          class_id: string | null;
        }[]
      ).map((row) => {
        const cid = row.class_id;
        return {
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          classId: cid,
          className: cid ? (nameByClassId.get(cid) ?? null) : null,
        };
      });
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
  njs?: string | null;
  promo?: string | null;
  of_name?: string | null;
  formation_number?: string | null;
  diploma?: string | null;
  tep?: string | null;
  birth_country?: string | null;
  birth_department?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  address_city?: string | null;
  address_country?: string | null;
  employment_status?: string | null;
  parcoursup?: string | null;
  validation_status?: string | null;
  uc1_status?: string | null;
  uc2_status?: string | null;
  uc3_status?: string | null;
  uc4_status?: string | null;
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
    njs: row.njs ?? null,
    promo: row.promo ?? null,
    ofName: row.of_name ?? null,
    formationNumber: row.formation_number ?? null,
    diploma: row.diploma ?? null,
    tep: row.tep ?? null,
    birthCountry: row.birth_country ?? null,
    birthDepartment: row.birth_department ?? null,
    phone: row.phone ?? null,
    addressLine1: row.address_line1 ?? null,
    addressLine2: row.address_line2 ?? null,
    postalCode: row.postal_code ?? null,
    addressCity: row.address_city ?? null,
    addressCountry: row.address_country ?? null,
    employmentStatus: row.employment_status ?? null,
    parcoursup: row.parcoursup ?? null,
    validationStatus: row.validation_status ?? null,
    uc1Status: row.uc1_status ?? null,
    uc2Status: row.uc2_status ?? null,
    uc3Status: row.uc3_status ?? null,
    uc4Status: row.uc4_status ?? null,
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
    title?: string | null;
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
    title:
      row.title && String(row.title).trim()
        ? String(row.title).trim()
        : null,
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
      SANCTION_TABLE_ROW_SELECT,
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
      SANCTION_TABLE_ROW_SELECT,
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

export async function fetchRecentSanctionsForUser(
  user: SessionUser,
  limit: number,
): Promise<Sanction[]> {
  const supabase = await staffReadSupabase();
  if (!supabase) return [];

  if (user.role === "ELEVE" && user.studentId) {
    const all = await fetchSanctionsForStudent(user.studentId);
    return all.filter((s) => s.status === "active").slice(0, limit);
  }

  const scope = await resolveSanctionsViewerScope(supabase, user);
  if (scope.kind === "none") return [];

  let query = supabase
    .from("sanctions")
    .select(SANCTION_TABLE_ROW_SELECT)
    .eq("status", "active")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (scope.kind === "authorOnly") {
    query = query.eq("author_id", scope.authorId);
  } else if (scope.kind === "studentIds") {
    query = query.in("student_id", scope.studentIds);
  }

  const { data: rows, error } = await query;
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

/** Prénom / nom pour affichage dashboard (lecture staff). */
export async function fetchStudentDisplayNamesByIds(
  studentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(studentIds)].filter(Boolean);
  if (unique.length === 0) return map;
  const supabase = await staffReadSupabase();
  if (!supabase) return map;
  const { data, error } = await supabase
    .from("students")
    .select("id,first_name,last_name")
    .in("id", unique);
  if (error || !data?.length) return map;
  for (const row of data as {
    id: string;
    first_name: string | null;
    last_name: string | null;
  }[]) {
    const label =
      `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || row.id;
    map.set(row.id, label);
  }
  return map;
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
      SANCTION_TABLE_ROW_SELECT,
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

export const formatCloudClassDisplayName = formatCloudClassDisplayNamePure;

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
  /**
   * Taille agrégée des objets bucket « documents » (Storage), si lisible depuis le backend.
   * null si fonction RPC ou table storage.objects indisponible (droits / migration non passée).
   */
  cloudStorageBytesTotal: number | null;
};

/** Interprète `storage.objects.metadata.size` (nombre ou chaîne décimale). */
function metadataObjectSizeBytes(meta: unknown): number {
  if (!meta || typeof meta !== "object") return 0;
  const m = meta as Record<string, unknown>;
  const raw = m.size;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.min(Math.floor(raw), Number.MAX_SAFE_INTEGER);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t && /^[0-9]+(\.[0-9]+)?$/.test(t))
      return Math.min(Math.floor(Number(t)), Number.MAX_SAFE_INTEGER);
  }
  return 0;
}

function coerceBigIntLikeToSafeNumber(raw: unknown): number | null {
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) {
    const n = Number(raw.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchCloudDocumentsBucketBytesTotal(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "dashboard_documents_storage_bytes_total",
  );
  if (!rpcErr && rpcData !== null && rpcData !== undefined) {
    const n = coerceBigIntLikeToSafeNumber(rpcData);
    if (n != null && n >= 0) return n;
  }

  const PAGE = 1000;
  let offset = 0;
  let total = 0;
  try {
    for (;;) {
      const { data: rows, error } = await supabase
        .schema("storage")
        .from("objects")
        .select("metadata")
        .eq("bucket_id", "documents")
        .range(offset, offset + PAGE - 1);
      if (error) {
        if (offset === 0) return null;
        break;
      }
      const chunk = rows ?? [];
      for (const r of chunk as { metadata?: unknown }[]) {
        total += metadataObjectSizeBytes(r.metadata);
      }
      if (chunk.length < PAGE) break;
      offset += PAGE;
    }
  } catch {
    return null;
  }
  return total;
}

/**
 * Totaux tableau de bord direction : service_role si dispo, sinon session (peut rester partiel sous RLS).
 */
export async function fetchDashboardDirectorStats(): Promise<DashboardDirectorStats> {
  const empty: DashboardDirectorStats = {
    teacherStaffCount: 0,
    studentCount: 0,
    activeClassCount: 0,
    fileCount: 0,
    cloudStorageBytesTotal: null,
  };
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return empty;

  const year = new Date().getFullYear();

  const [profRes, studRes, filesRes, cloudBytesTotal] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or(
        "base_role.eq.PROFESSEUR,base_role.eq.PROF_PRINCIPAL,base_role.eq.DIRECTEUR,base_role.eq.ADMINISTRATEUR",
      ),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("files").select("id", { count: "exact", head: true }),
    fetchCloudDocumentsBucketBytesTotal(supabase),
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
    cloudStorageBytesTotal:
      typeof cloudBytesTotal === "number" &&
      Number.isFinite(cloudBytesTotal) &&
      cloudBytesTotal >= 0
        ? cloudBytesTotal
        : null,
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
  /** Titularisation : mise en évidence visuelle pour le PP sur cette classe. */
  isPrincipalClass?: boolean;
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

export async function fetchCloudStudentUploadOptions(opts?: {
  restrictClassIds?: string[] | null;
}): Promise<CloudStudentUploadOption[]> {
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

  /** `undefined` = pas de restriction (direction). `[]` ou liste = uniquement ces classes. */
  const restrictIds = opts?.restrictClassIds;
  const restrict =
    restrictIds != null ? new Set(restrictIds) : null;

  let studs = data as {
    id: string;
    first_name: string;
    last_name: string;
    class_id: string | null;
  }[];

  if (restrict !== null) {
    studs = studs.filter((s) => {
      const cid = s.class_id;
      return Boolean(cid && restrict.has(cid));
    });
  }

  return studs.map((s) => {
    const name = `${s.first_name} ${s.last_name}`.trim() || "—";
    const cid = s.class_id;
    const cl = cid ? classLabelById.get(cid) ?? null : null;
    const label = cl ? `${name} · ${cl}` : name;
    return { id: s.id, label, classId: cid };
  });
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
 * Dossiers Cloud : classes, professeurs, élèves + comptages fichiers
 * visibles selon `viewerRole`.
 */
export async function fetchCloudExplorerFolders(
  viewerRole: UserRole,
  opts?: {
    studentClassId?: string | null;
    /** Limité aux IDs fournis : périmètre enseignant (titulaire ∪ affectations). `[]` = aucune classe. */
    teacherScopedClassIds?: string[] | null;
    viewerId?: string | null;
    /** Classes où le PP est titulaire (badge / style carte). */
    principalClassIds?: string[] | null;
  },
): Promise<{
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

  const classRowsAll = await loadAllClassRows(supabase);

  let classRows = classRowsAll;
  if (viewerRole === "ELEVE") {
    const cid = opts?.studentClassId ?? null;
    if (!cid) return empty;
    classRows = classRowsAll.filter((c) => c.id === cid);
    if (!classRows.length) return empty;
  }

  const scopeRestricted =
    viewerRole !== "ELEVE" && opts?.teacherScopedClassIds != null;
  const scopeSet = scopeRestricted
    ? new Set(opts!.teacherScopedClassIds!)
    : null;

  if (scopeSet) {
    classRows = classRowsAll.filter((c) => scopeSet.has(c.id));
  }

  const principalSet =
    opts?.principalClassIds && opts.principalClassIds.length > 0
      ? new Set(opts.principalClassIds)
      : null;

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

  const studentClassById = new Map<string, string>();
  if (!studErr && studRows) {
    for (const row of studRows as {
      id: string;
      class_id: string | null;
    }[]) {
      if (row.class_id) studentClassById.set(row.id, row.class_id);
    }
  }

  let fileRows: {
    class_id?: string | null;
    owner_id?: string | null;
    student_id?: string | null;
    cloud_audience?: string | null;
  }[] | null = null;

  let fileErr: unknown = null;
  const fullFileSelect = await supabase
    .from("files")
    .select("class_id,owner_id,student_id,cloud_audience");

  if (
    fullFileSelect.error &&
    String(fullFileSelect.error.message ?? "").includes("cloud_audience")
  ) {
    const fb = await supabase.from("files").select("class_id,owner_id,student_id");
    fileRows = fb.data ?? null;
    fileErr = fb.error;
    for (const f of fileRows ?? []) {
      f.cloud_audience = "BOTH";
    }
  } else {
    fileRows = fullFileSelect.data ?? null;
    fileErr = fullFileSelect.error;
  }

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

  const viewerIdForScope = opts?.viewerId ?? null;

  const fileMatchesTeacherScope = (
    f: {
      class_id?: string | null;
      owner_id?: string | null;
      student_id?: string | null | undefined;
    },
  ): boolean => {
    if (!scopeSet) return true;
    const cid = (f.class_id as string | null | undefined) ?? null;
    if (cid && scopeSet.has(cid)) return true;
    const sid = f.student_id as string | null | undefined;
    if (sid) {
      const sc = studentClassById.get(sid);
      if (sc && scopeSet.has(sc)) return true;
    }
    const oid = (f.owner_id as string | null | undefined) ?? null;
    if (!cid && oid && viewerIdForScope && oid === viewerIdForScope) return true;
    return false;
  };

  const classCounts = new Map<string, number>();
  const ownerCounts = new Map<string, number>();
  const studentCounts = new Map<string, number>();
  if (!fileErr && fileRows?.length) {
    for (const f of fileRows) {
      const aud = normalizeCloudDocumentAudience(f.cloud_audience);
      if (!viewerSeesCloudDocumentAudience(viewerRole, aud)) {
        continue;
      }
      if (!fileMatchesTeacherScope(f)) {
        continue;
      }
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
    isPrincipalClass: principalSet?.has(c.id) ?? false,
  }));

  let teachers: CloudExplorerTeacherFolder[] = [];
  if (viewerRole !== "ELEVE" && !profErr && profRows) {
    type ProfRow = { id: string; first_name: string; last_name: string };
    const profList = profRows as ProfRow[];
    if (!scopeSet) {
      teachers = profList.map((p) => ({
        id: p.id,
        displayName: `${p.first_name} ${p.last_name}`.trim() || "—",
        documentCount: ownerCounts.get(p.id) ?? 0,
      }));
    } else if (viewerIdForScope) {
      const me = profList.find((p) => p.id === viewerIdForScope);
      if (me) {
        teachers = [
          {
            id: me.id,
            displayName: `${me.first_name} ${me.last_name}`.trim() || "—",
            documentCount: ownerCounts.get(me.id) ?? 0,
          },
        ];
      }
    }
  }

  let students: CloudExplorerStudentFolder[] = [];
  if (viewerRole !== "ELEVE" && !studErr && studRows) {
    let studs = studRows as {
      id: string;
      first_name: string;
      last_name: string;
      class_id: string | null;
    }[];
    if (scopeSet) {
      studs = studs.filter((s) => {
        const cid = s.class_id;
        return Boolean(cid && scopeSet.has(cid));
      });
    }
    students = studs.map((s) => {
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

export type ClassCloudFolderRow = {
  id: string;
  classId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  /** `STUDENT_INBOX` = racine « Documents des élèves ». */
  systemKind: string | null;
};

/** Nœud hiérarchique (sous-dossiers cloud d’une classe). */
export type ClassCloudFolderNode = {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  systemKind: string | null;
  children: ClassCloudFolderNode[];
};

export { STUDENT_INBOX_FOLDER_KIND };

export function getStudentInboxFolderId(
  rows: ClassCloudFolderRow[],
): string | null {
  return getStudentInboxFolderIdPure(rows);
}

/** Périmètre dossiers cloud pour un élève : tout l’arbre « Documents des élèves ». */
export type StudentCloudDepositScope = {
  inboxId: string | null;
  landingFolderId: string | null;
};

export function resolveStudentClassCloudDepositScope(
  rows: ClassCloudFolderRow[],
): StudentCloudDepositScope {
  const inboxId = getStudentInboxFolderId(rows);
  return { inboxId, landingFolderId: inboxId };
}

export function studentMayAccessClassCloudDepositFolder(
  rows: ClassCloudFolderRow[],
  folderId: string | null,
): boolean {
  if (!folderId) return false;
  return isClassFolderInStudentUploadTree(rows, folderId);
}

/** IDs des dossiers sous « Documents des élèves » (inbox + tous les descendants). */
export function collectStudentDepositAccessibleFolderIds(
  rows: ClassCloudFolderRow[],
  scope: StudentCloudDepositScope,
): string[] {
  const root = scope.inboxId ?? scope.landingFolderId;
  if (!root) return [];
  const out: string[] = [];
  const walk = (id: string) => {
    out.push(id);
    for (const r of rows) {
      if (r.parentId === id) walk(r.id);
    }
  };
  walk(root);
  return out;
}

export async function ensureClassStudentInboxFolder(
  admin: SupabaseClient,
  classId: string,
): Promise<void> {
  const { data: exists } = await admin
    .from("class_cloud_folders")
    .select("id")
    .eq("class_id", classId)
    .eq("system_kind", STUDENT_INBOX_FOLDER_KIND)
    .maybeSingle();
  if (exists?.id) return;

  await admin.from("class_cloud_folders").insert({
    class_id: classId,
    parent_id: null,
    name: "Documents des élèves",
    sort_order: -999,
    is_system: true,
    system_kind: STUDENT_INBOX_FOLDER_KIND,
  });
}

export function isFolderDescendantOf(
  rows: ClassCloudFolderRow[],
  folderId: string,
  ancestorId: string,
): boolean {
  const byId = new Map(rows.map((r) => [r.id, r]));
  let cur: string | null = folderId;
  for (let i = 0; i < 200 && cur; i += 1) {
    if (cur === ancestorId) return true;
    const row = byId.get(cur);
    cur = row?.parentId ?? null;
  }
  return false;
}

/** Fichiers dans l’arbre « Documents des élèves » (y compris la racine inbox). */
export function isClassFolderInStudentUploadTree(
  rows: ClassCloudFolderRow[],
  classFolderId: string | null,
): boolean {
  const inbox = getStudentInboxFolderId(rows);
  if (!inbox) return false;
  if (classFolderId === inbox) return true;
  if (!classFolderId) return false;
  return isFolderDescendantOf(rows, classFolderId, inbox);
}

export async function fetchClassCloudFoldersFlat(
  classId: string,
): Promise<ClassCloudFolderRow[]> {
  const admin = createAdminSupabase();
  if (admin) {
    await ensureClassStudentInboxFolder(admin, classId);
  }
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return [];
  let selectFields =
    "id,class_id,parent_id,name,sort_order,is_system,system_kind";
  let { data, error } = await supabase
    .from("class_cloud_folders")
    .select(selectFields)
    .eq("class_id", classId);

  if (
    error &&
    (String(error.message ?? "").includes("system_kind") ||
      String(error.message ?? "").includes("is_system"))
  ) {
    selectFields = "id,class_id,parent_id,name,sort_order";
    ({ data, error } = await supabase
      .from("class_cloud_folders")
      .select(selectFields)
      .eq("class_id", classId));
  }

  if (error) return [];
  if (!data?.length) return [];

  const hasMeta = selectFields.includes("system_kind");
  type Raw = {
    id: string;
    class_id: string;
    parent_id: string | null;
    name: string;
    sort_order: number;
    is_system?: boolean | null;
    system_kind?: string | null;
  };

  return (data as unknown as Raw[]).map((r) => ({
    id: r.id,
    classId: r.class_id,
    parentId: r.parent_id,
    name: r.name,
    sortOrder: r.sort_order,
    isSystem: hasMeta ? Boolean(r.is_system) : false,
    systemKind: hasMeta ? (r.system_kind ?? null) : null,
  }));
}

export function buildClassCloudFolderTree(
  rows: ClassCloudFolderRow[],
): ClassCloudFolderNode[] {
  const byParent = new Map<string | null, ClassCloudFolderRow[]>();
  for (const r of rows) {
    const p = r.parentId;
    const arr = byParent.get(p) ?? [];
    arr.push(r);
    byParent.set(p, arr);
  }
  for (const [, arr] of byParent) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const build = (parentId: string | null): ClassCloudFolderNode[] => {
    const list = byParent.get(parentId) ?? [];
    return list.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: r.sortOrder,
      isSystem: r.isSystem,
      systemKind: r.systemKind,
      children: build(r.id),
    }));
  };
  return build(null);
}

export async function fetchClassCloudFolderTree(
  classId: string,
): Promise<ClassCloudFolderNode[]> {
  const rows = await fetchClassCloudFoldersFlat(classId);
  return buildClassCloudFolderTree(rows);
}

/** Emplacements réservés aux dépôts élèves (inbox + sous-dossiers créés par l’équipe). */
export function flattenClassCloudStudentInboxOptions(
  nodes: ClassCloudFolderNode[],
  rootLabel?: string,
): { id: string; label: string }[] {
  const inbox = nodes.find(
    (n) =>
      n.systemKind === STUDENT_INBOX_FOLDER_KIND ||
      n.name.trim() === "Documents des élèves",
  );
  if (!inbox) return [];
  const out: { id: string; label: string }[] = [
    { id: inbox.id, label: rootLabel ?? inbox.name },
  ];
  const walk = (list: ClassCloudFolderNode[], depth: number) => {
    const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
    const pad = "\u2003".repeat(Math.max(0, depth));
    for (const n of sorted) {
      out.push({ id: n.id, label: `${pad}${n.name}` });
      if (n.children.length) walk(n.children, depth + 1);
    }
  };
  walk(inbox.children, 1);
  return out;
}

/** Options du sélecteur « emplacement » (racine + arbre indenté). */
export function flattenClassCloudFolderOptions(
  nodes: ClassCloudFolderNode[],
  rootLabel: string,
): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [
    { id: "__root__", label: rootLabel },
  ];
  const walk = (list: ClassCloudFolderNode[], depth: number) => {
    const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
    const pad = "\u2003".repeat(Math.max(0, depth));
    for (const n of sorted) {
      out.push({ id: n.id, label: `${pad}${n.name}` });
      if (n.children.length) walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

/** Enfants directs d’un parent (`null` = racine). */
export function filterClassCloudFoldersByParent(
  rows: ClassCloudFolderRow[],
  parentId: string | null,
): ClassCloudFolderRow[] {
  return rows
    .filter((r) => (r.parentId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

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
  /** Classé pour élèves, équipe seule ou les deux. */
  cloudAudience: CloudDocumentAudience;
  /** Classe associée au fichier (nullable). */
  classId: string | null;
  /** Professeur ou auteur du dépôt (auth user id). */
  ownerId: string | null;
  /** Élève associé au fichier (nullable). */
  studentId: string | null;
  /** Sous-dossier classe (`null` = racine de l’espace classe). */
  classFolderId: string | null;
  /** Chemin dans le bucket `documents` pour la version affichée. */
  storagePath: string | null;
};

export type CloudFolderFileWithUrl = CloudFolderFileRow & {
  signedUrl: string | null;
};
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
  opts?: { classFolderId?: string | null; viewerRole?: UserRole },
): Promise<CloudFolderFileRow[]> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await supabaseOrNull());
  if (!supabase) return [];

  const legacySelect =
    "id,logical_key,mime,created_at,class_id,owner_id";

  const col =
    kind === "class"
      ? "class_id"
      : kind === "teacher"
        ? "owner_id"
        : "student_id";

  const classFolderTarget =
    kind === "class" ? (opts?.classFolderId ?? null) : undefined;

  const buildQuery = (sel: string, applyFolder: boolean) => {
    let q = supabase.from("files").select(sel).eq(col, entityId);
    if (applyFolder && kind === "class" && classFolderTarget !== undefined) {
      if (classFolderTarget) {
        q = q.eq("class_folder_id", classFolderTarget);
      } else {
        q = q.is("class_folder_id", null);
      }
    }
    return q.order("created_at", { ascending: false });
  };

  let folderFilterActive = kind === "class";
  let selectFields =
    "id,title,description,logical_key,mime,created_at,class_id,owner_id,student_id,class_folder_id,cloud_audience";

  let res = await buildQuery(selectFields, folderFilterActive);

  if (res.error && String(res.error.message ?? "").includes("cloud_audience")) {
    selectFields = selectFields.replace(/,cloud_audience\b/, "");
    res = await buildQuery(selectFields, folderFilterActive);
  }

  if (res.error) {
    if (kind === "student") {
      return [];
    }
    const msg = String(res.error.message ?? "");
    if (kind === "class" && msg.includes("class_folder")) {
      folderFilterActive = false;
      selectFields = selectFields.replace(/,class_folder_id\b/, "");
      res = await buildQuery(selectFields, false);
    }
    if (res.error) {
      res = await buildQuery(legacySelect, false);
      folderFilterActive = false;
    }
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
    class_folder_id?: string | null;
    cloud_audience?: string | null;
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

  const mapped = rows.map((f) => {
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
      cloudAudience: normalizeCloudDocumentAudience(f.cloud_audience),
      classId: f.class_id ?? null,
      ownerId: f.owner_id ?? null,
      studentId: f.student_id ?? null,
      classFolderId:
        folderFilterActive && kind === "class"
          ? (f.class_folder_id ?? null)
          : null,
      storagePath: lv?.storagePath || null,
    };
  });

  const vr = opts?.viewerRole;
  return vr
    ? mapped.filter((row) =>
        viewerSeesCloudDocumentAudience(vr, row.cloudAudience),
      )
    : mapped;
}


/**
 * Tous les fichiers Cloud avec libellés classe et professeur (explorateur racine),
 * limités aux audiences visibles par `viewerRole` si défini.
 */
export async function fetchAllCloudExplorerFiles(
  viewerRole?: UserRole,
  opts?: {
    restrictClassId?: string | null;
    teacherScopedClassIds?: string[] | null;
    viewerId?: string | null;
  },
): Promise<CloudExplorerFileRow[]> {
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

  let fullSelect =
    "id,title,description,logical_key,mime,created_at,class_id,owner_id,student_id,class_folder_id,cloud_audience";
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
    class_folder_id?: string | null;
    cloud_audience?: string | null;
  };

  const tryFilesSelect = (sel: string) =>
    supabase.from("files").select(sel).order("created_at", { ascending: false });

  let sel = fullSelect;
  let res = await tryFilesSelect(sel);

  if (res.error && String(res.error.message ?? "").includes("cloud_audience")) {
    sel = sel.replace(/,cloud_audience\b/, "");
    res = await tryFilesSelect(sel);
  }

  if (res.error && String(res.error.message ?? "").includes("class_folder")) {
    res = await tryFilesSelect(sel.replace(/,class_folder_id\b/, ""));
  }

  if (res.error) {
    res = await tryFilesSelect(legacySelect);
  }

  const data = res.data as FileRowAll[] | null;
  const error = res.error;

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

  const mapped = rows.map((f) => {
    const id = f.id;
    const titleRaw = f.title?.trim();
    const logicalKey = String(f.logical_key ?? "");
    const lv = latest.get(id);
    const cid = (f.class_id as string | null | undefined) ?? null;
    const oid = (f.owner_id as string | null | undefined) ?? null;
    const sid = (f.student_id as string | null | undefined) ?? null;
    const aud = normalizeCloudDocumentAudience(f.cloud_audience);
    return {
      id,
      title: titleRaw || logicalKey,
      description: String(f.description ?? ""),
      mime: f.mime ?? null,
      createdAt: String(f.created_at ?? ""),
      version: lv?.version ?? 1,
      cloudAudience: aud,
      storagePath: lv?.storagePath || null,
      classId: cid,
      ownerId: oid,
      studentId: sid,
      classFolderId: f.class_folder_id ?? null,
      classLabel: cid ? classLabelById.get(cid) ?? null : null,
      teacherName: oid ? teacherNameById.get(oid) ?? null : null,
      studentName: sid ? studentNameById.get(sid) ?? null : null,
    };
  });

  let filtered = viewerRole
    ? mapped.filter((row) =>
        viewerSeesCloudDocumentAudience(viewerRole, row.cloudAudience),
      )
    : mapped;

  if (viewerRole === "ELEVE" && opts?.restrictClassId) {
    filtered = filtered.filter((row) => row.classId === opts.restrictClassId);
  }

  const scopeRestricted =
    viewerRole &&
    viewerRole !== "ELEVE" &&
    opts?.teacherScopedClassIds != null;
  if (scopeRestricted) {
    const scopeSet = new Set(opts!.teacherScopedClassIds!);
    const vid = opts?.viewerId ?? null;
    const studentIdsForScope = [
      ...new Set(
        filtered
          .map((r) => r.studentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const studentClassMap = new Map<string, string>();
    if (studentIdsForScope.length > 0) {
      const { data: studScopeRows } = await supabase
        .from("students")
        .select("id,class_id")
        .in("id", studentIdsForScope);
      for (const row of studScopeRows ?? []) {
        const cid = (row.class_id as string | null | undefined) ?? null;
        if (cid) studentClassMap.set(row.id as string, cid);
      }
    }
    filtered = filtered.filter((row) => {
      if (row.classId && scopeSet.has(row.classId)) return true;
      if (row.studentId) {
        const eff =
          row.classId ?? studentClassMap.get(row.studentId) ?? null;
        if (eff && scopeSet.has(eff)) return true;
      }
      if (!row.classId && row.ownerId && vid && row.ownerId === vid)
        return true;
      return false;
    });
  }

  return filtered;
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
