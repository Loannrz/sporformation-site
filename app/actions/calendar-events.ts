"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { hasPermission } from "@/lib/permissions";
import { isStaffAdmin } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CalendarEventType } from "@/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function revalidateCalendarViews(locale: AppLocale) {
  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/calendrier`);
  revalidatePath(`/${locale}/admin/calendar`);
}

const ATT_TYPES = ["course", "meeting", "school_event", "deadline"] as const;

function parseKind(raw: string): CalendarEventType {
  const t = raw.trim();
  return (ATT_TYPES as readonly string[]).includes(t)
    ? (t as CalendarEventType)
    : "school_event";
}

const SHARE_AUD = [
  "ALL_STAFF",
  "CLASSROOM_TEACHERS",
  "HEAD_TEACHERS_ONLY",
  "DIRECTION_ONLY",
  "SPECIFIC_TARGETS",
] as const;

function parseAudience(
  raw: string,
): (typeof SHARE_AUD)[number] {
  const a = raw.trim();
  return (SHARE_AUD as readonly string[]).includes(a)
    ? (a as (typeof SHARE_AUD)[number])
    : "ALL_STAFF";
}

export async function createPersonalCalendarEventAction(
  locale: AppLocale,
  input: {
    title: string;
    startsAt: string;
    endsAt: string;
    description?: string;
    kind?: string;
  },
) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "VIEW_CALENDAR")) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const title = input.title.trim();
  if (!title) return { ok: false as const, error: "TITLE_REQUIRED" as const };

  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false as const, error: "DATES_INVALID" as const };
  }
  if (end.getTime() < start.getTime()) {
    return { ok: false as const, error: "RANGE_INVALID" as const };
  }

  const insertRow: Record<string, unknown> = {
    title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    kind: parseKind(input.kind ?? "school_event"),
    personal: true,
    audience: null,
    description: input.description?.trim() || null,
    created_by: user.id,
    class_id: null,
    teacher_id: null,
  };

  let { error } = await admin.from("calendar_events").insert(insertRow);
  if (error && /column personal|column audience/i.test(error.message ?? "")) {
    const legacy = {
      title,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      kind: parseKind(input.kind ?? "school_event"),
      created_by: user.id,
      class_id: null as string | null,
      teacher_id: null as string | null,
    };
    ({ error } = await admin.from("calendar_events").insert(legacy));
  }

  if (error) {
    console.error("personal calendar insert", error.message);
    return { ok: false as const, error: "INSERT_FAILED" as const };
  }

  revalidateCalendarViews(locale);
  return { ok: true as const };
}

export async function createSchoolCalendarEventAction(
  locale: AppLocale,
  input: {
    title: string;
    startsAt: string;
    endsAt: string;
    description?: string;
    kind?: string;
    audience: string;
    profileIds?: string[];
    classIds?: string[];
    studentIds?: string[];
  },
) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const title = input.title.trim();
  if (!title) return { ok: false as const, error: "TITLE_REQUIRED" as const };

  const audience = parseAudience(input.audience);

  let profileIds = (input.profileIds ?? []).filter((id) => UUID_RE.test(id));
  let classIds = (input.classIds ?? []).filter((id) => UUID_RE.test(id));
  let studentIds = (input.studentIds ?? []).filter((id) => UUID_RE.test(id));

  if (audience === "SPECIFIC_TARGETS") {
    if (!profileIds.length && !classIds.length && !studentIds.length) {
      return {
        ok: false as const,
        error: "TARGETS_REQUIRED" as const,
      };
    }
  }

  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false as const, error: "DATES_INVALID" as const };
  }
  if (end.getTime() < start.getTime()) {
    return { ok: false as const, error: "RANGE_INVALID" as const };
  }

  const insertRow: Record<string, unknown> = {
    title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    kind: parseKind(input.kind ?? "school_event"),
    personal: false,
    audience,
    description: input.description?.trim() || null,
    created_by: user.id,
    class_id: null,
    teacher_id: null,
  };

  let ins = await admin
    .from("calendar_events")
    .insert(insertRow)
    .select("id")
    .maybeSingle();

  let error = ins.error;
  let rowId = ins.data?.id as string | undefined;

  const missingNewCols =
    error &&
    (/column .*personal/i.test(error.message ?? "") ||
      /column .*audience/i.test(error.message ?? ""));

  if (missingNewCols) {
    const legacyClassId =
      audience === "SPECIFIC_TARGETS" ? classIds[0] ?? null : null;

    ins = await admin
      .from("calendar_events")
      .insert({
        title,
        starts_at: insertRow.starts_at,
        ends_at: insertRow.ends_at,
        kind: insertRow.kind,
        created_by: user.id,
        class_id: legacyClassId,
        teacher_id: null,
      })
      .select("id")
      .maybeSingle();
    error = ins.error;
    rowId = ins.data?.id as string | undefined;
    profileIds = [];
    studentIds = [];
    if (audience !== "SPECIFIC_TARGETS") {
      classIds = [];
    } else if (classIds.length > 1) {
      classIds = classIds.slice(0, 1);
    }
  }

  if (error || !rowId) {
    console.error("school calendar insert", error?.message);
    return { ok: false as const, error: "INSERT_FAILED" as const };
  }

  if (
    audience === "SPECIFIC_TARGETS" &&
    (profileIds.length || classIds.length || studentIds.length)
  ) {
    const rows = [
      ...profileIds.map((entity_id) => ({
        event_id: rowId,
        entity_type: "profile" as const,
        entity_id,
      })),
      ...classIds.map((entity_id) => ({
        event_id: rowId,
        entity_type: "class" as const,
        entity_id,
      })),
      ...studentIds.map((entity_id) => ({
        event_id: rowId,
        entity_type: "student" as const,
        entity_id,
      })),
    ];
    const { error: tErr } = await admin
      .from("calendar_event_targets")
      .insert(rows as never);
    if (tErr) {
      console.error("calendar_event_targets", tErr.message);
      await admin.from("calendar_events").delete().eq("id", rowId);
      return { ok: false as const, error: "TARGETS_FAILED" as const };
    }
  }

  revalidateCalendarViews(locale);
  return { ok: true as const };
}

export async function deleteCalendarEventAction(
  locale: AppLocale,
  eventId: string,
) {
  const user = await getSessionUser();
  const id = eventId.trim();
  if (!user || !UUID_RE.test(id)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const sel = await admin
    .from("calendar_events")
    .select("id,personal,created_by")
    .eq("id", id)
    .maybeSingle();

  type RowMinimal = {
    personal: boolean | null;
    created_by: string | null;
  };

  let row = sel.data as RowMinimal | null;
  let permError = sel.error;

  if (permError?.message?.includes("personal")) {
    const fb = await admin
      .from("calendar_events")
      .select("id,created_by")
      .eq("id", id)
      .maybeSingle();
    row = fb.data
      ? { personal: false, created_by: (fb.data as { created_by: string | null }).created_by }
      : null;
    permError = fb.error as typeof permError;
  }

  if (permError || !row)
    return { ok: false as const, error: "NOT_FOUND" as const };

  const isPersonal = !!row.personal;
  const isOwner = row.created_by === user.id;
  const canDeleteSchool = !isPersonal && isStaffAdmin(user);

  if (!((isPersonal && isOwner) || canDeleteSchool)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  await admin.from("calendar_event_targets").delete().eq("event_id", id);
  const { error } = await admin.from("calendar_events").delete().eq("id", id);
  if (error) {
    return { ok: false as const, error: "DELETE_FAILED" as const };
  }

  revalidateCalendarViews(locale);
  return { ok: true as const };
}
