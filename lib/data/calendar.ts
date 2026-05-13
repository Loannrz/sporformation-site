import { userSeesSharedCalendarRow } from "@/lib/calendar-shared-visibility";
import type { CalendarEvent, CalendarEventTarget, CalendarEventType } from "@/types";
import type { SessionUser } from "@/types";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

type DbKind = string;

function mapKind(raw: DbKind | null | undefined): CalendarEventType {
  const k = raw ?? "school_event";
  if (
    k === "course" ||
    k === "meeting" ||
    k === "school_event" ||
    k === "deadline"
  ) {
    return k;
  }
  return "school_event";
}

function mapRow(row: {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  kind: DbKind | null;
  personal: boolean | null;
  audience: string | null;
  description: string | null;
  created_by: string | null;
  class_id: string | null;
  teacher_id: string | null;
}): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    personal: !!row.personal,
    audience: row.personal ? null : row.audience as CalendarEvent["audience"],
    createdBy: row.created_by,
    start: row.starts_at,
    end: row.ends_at,
    type: mapKind(row.kind),
    classId: row.class_id ?? undefined,
    teacherId: row.teacher_id ?? undefined,
  };
}

const SELECT_WIDE =
  "id,title,starts_at,ends_at,kind,class_id,teacher_id,created_by,personal,description,audience";
const SELECT_NARROW =
  "id,title,starts_at,ends_at,kind,class_id,teacher_id,created_by";

async function loadEventsFromDb(supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>): Promise<
  CalendarEvent[]
> {
  let { data, error } = await supabase
    .from("calendar_events")
    .select(SELECT_WIDE)
    .order("starts_at", { ascending: true });

  if (error && /column|personal|audience/i.test(error.message ?? "")) {
    const fb = await supabase
      .from("calendar_events")
      .select(SELECT_NARROW)
      .order("starts_at", { ascending: true });
    data = fb.data?.map((r) => ({
      ...r,
      personal: false,
      description: null,
      audience: "ALL_STAFF" as string | null,
    })) as typeof data;
    error = fb.error as typeof error;
  }

  if (error || !data) return [];
  return data.map((r) =>
    mapRow(
      r as {
        id: string;
        title: string;
        starts_at: string;
        ends_at: string;
        kind: DbKind | null;
        personal: boolean | null;
        audience: string | null;
        description: string | null;
        created_by: string | null;
        class_id: string | null;
        teacher_id: string | null;
      },
    ),
  );
}

export async function fetchCalendarEventsVisibleToUser(
  user: SessionUser,
): Promise<CalendarEvent[]> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await createServerSupabase());
  if (!supabase) return [];

  const base = await loadEventsFromDb(supabase);
  if (!base.length) return [];

  const ids = base.map((e) => e.id);

  let targetsByEvent = new Map<string, CalendarEventTarget[]>();
  try {
    const { data: trows } = await supabase
      .from("calendar_event_targets")
      .select("event_id,entity_type,entity_id")
      .in("event_id", ids);
    if (trows) {
      targetsByEvent = new Map();
      for (const t of trows as {
        event_id: string;
        entity_type: string;
        entity_id: string;
      }[]) {
        const typ = t.entity_type;
        if (
          typ !== "profile" &&
          typ !== "class" &&
          typ !== "student"
        )
          continue;
        const arr = targetsByEvent.get(t.event_id) ?? [];
        arr.push({ type: typ, id: t.entity_id });
        targetsByEvent.set(t.event_id, arr);
      }
    }
  } catch {
    /* table absente avant migration */
  }

  let studentClassId = new Map<string, string>();
  try {
    const { data: studs } = await supabase.from("students").select("id,class_id");
    if (studs) {
      for (const s of studs as { id: string; class_id: string | null }[]) {
        if (s.class_id) studentClassId.set(s.id, s.class_id);
      }
    }
  } catch {
    studentClassId = new Map();
  }

  const out: CalendarEvent[] = [];

  for (const ev of base) {
    const targets = targetsByEvent.get(ev.id) ?? [];

    if (ev.personal) {
      if (ev.createdBy === user.id) {
        out.push({ ...ev, targets: targets.length ? targets : undefined });
      }
      continue;
    }

    const rowLike = {
      audience: ev.audience as string | null,
      class_id: ev.classId ?? null,
      teacher_id: ev.teacherId ?? null,
    };
    if (
      userSeesSharedCalendarRow(user, rowLike, targets, studentClassId)
    ) {
      out.push({ ...ev, targets });
    }
  }

  return out.sort(
    (a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}

export type CalendarStudentOption = {
  id: string;
  label: string;
  classId: string | null;
};

export async function fetchStudentsMinimalForCalendar(): Promise<
  CalendarStudentOption[]
> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await createServerSupabase());
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("students")
    .select("id,first_name,last_name,class_id")
    .order("last_name", { ascending: true });

  if (error || !data) return [];
  return (
    data as unknown as Array<{
      id: string;
      first_name: string;
      last_name: string;
      class_id: string | null;
    }>
  ).map((r) => ({
    id: r.id,
    label: `${r.first_name} ${r.last_name}`.trim(),
    classId: r.class_id,
  }));
}
