import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const STUDENT_ADMIN_SELECT = [
  "id,first_name,last_name,email,photo_url,class_id,entry_date,birth_date,sex,birth_place",
  "id,first_name,last_name,email,photo_url,class_id,entry_date",
] as const;

export type StudentAdminListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  classId: string | null;
  className: string | null;
  birthDate: string | null;
  sex: string | null;
  birthPlace: string | null;
  age: number | null;
  photoUrl: string | null;
};

export type StudentAdminDetail = StudentAdminListItem & {
  entryDate: string | null;
  principalDisplayName: string | null;
  sanctionsTotal: number;
  sanctionsActive: number;
  sanctionsRetard: number;
};

function ageFromBirthDate(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

type StudentRowDb = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url?: string | null;
  class_id: string | null;
  birth_date?: string | null;
  sex?: string | null;
  birth_place?: string | null;
};

function mapListRow(
  r: StudentRowDb,
  className: string | null,
): StudentAdminListItem {
  const birth = (r.birth_date as string | null | undefined) ?? null;
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    classId: r.class_id,
    className,
    birthDate: birth,
    sex: (r.sex as string | null | undefined) ?? null,
    birthPlace: (r.birth_place as string | null | undefined) ?? null,
    age: ageFromBirthDate(birth),
    photoUrl: (r.photo_url as string | null | undefined) ?? null,
  };
}

async function loadStudentsWithClasses(supabase: SupabaseClient) {
  let rows: StudentRowDb[] | null = null;

  for (const sel of STUDENT_ADMIN_SELECT) {
    const r = await supabase
      .from("students")
      .select(sel)
      .order("last_name", { ascending: true });
    if (!r.error && r.data) {
      rows = r.data as unknown as StudentRowDb[];
      break;
    }
  }
  if (!rows) return [];

  const { data: classes } = await supabase.from("classes").select("id,name");
  const nameById = new Map<string, string>();
  for (const c of classes ?? []) {
    nameById.set(c.id, c.name);
  }

  return rows.map((row) =>
    mapListRow(row, row.class_id ? nameById.get(row.class_id) ?? null : null),
  );
}

export async function fetchAllStudentsForAdmin(): Promise<
  StudentAdminListItem[]
> {
  const admin = createAdminSupabase();
  const session = admin ?? (await createServerSupabase());
  if (!session) return [];
  return loadStudentsWithClasses(session);
}

type StudentDetailRowDb = StudentRowDb & { entry_date?: string | null };

async function loadSanctionStatsForStudent(
  session: SupabaseClient,
  studentId: string,
): Promise<{
  total: number;
  active: number;
  retard: number;
}> {
  const base = () =>
    session.from("sanctions").select("*", { count: "exact", head: true });

  const [{ count: total }, { count: active }, { count: retard }] =
    await Promise.all([
      base().eq("student_id", studentId),
      base().eq("student_id", studentId).eq("status", "active"),
      base().eq("student_id", studentId).eq("type", "retard"),
    ]);

  return {
    total: total ?? 0,
    active: active ?? 0,
    retard: retard ?? 0,
  };
}

export async function fetchStudentAdminDetail(
  studentId: string,
): Promise<StudentAdminDetail | null> {
  const admin = createAdminSupabase();
  const session = admin ?? (await createServerSupabase());
  if (!session) return null;

  let row: StudentDetailRowDb | null = null;

  for (const sel of STUDENT_ADMIN_SELECT) {
    const q = `${sel}`;
    const r = await session
      .from("students")
      .select(q)
      .eq("id", studentId)
      .maybeSingle();
    if (!r.error && r.data) {
      row = r.data as unknown as StudentDetailRowDb;
      break;
    }
  }
  if (!row) return null;

  let className: string | null = null;
  let principalDisplayName: string | null = null;

  if (row.class_id) {
    const { data: cls } = await session
      .from("classes")
      .select("name,principal_id")
      .eq("id", row.class_id)
      .maybeSingle();
    className = cls?.name ?? null;
    const principalId = cls?.principal_id as string | null | undefined;
    if (principalId) {
      const { data: prof } = await session
        .from("profiles")
        .select("first_name,last_name")
        .eq("id", principalId)
        .maybeSingle();
      if (prof) {
        principalDisplayName =
          `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim() ||
          null;
      }
    }
  }

  const sanctionStats = await loadSanctionStatsForStudent(session, studentId);

  return {
    ...mapListRow(row, className),
    entryDate: (row.entry_date as string | null | undefined) ?? null,
    principalDisplayName,
    sanctionsTotal: sanctionStats.total,
    sanctionsActive: sanctionStats.active,
    sanctionsRetard: sanctionStats.retard,
  };
}
