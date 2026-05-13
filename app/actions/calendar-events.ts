"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/i18n/routing";
import { hasPermission } from "@/lib/permissions";
import { isStaffAdmin } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
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

/** Écriture préférée avec la clé service_role ; sinon session cookie (Politiques « staff » RLS suffisantes en local sans service_role). */
async function calendarWriteClientPreferAdmin(): Promise<SupabaseClient | null> {
  return createAdminSupabase() ?? (await createServerSupabase());
}

/**
 * Détecte l'erreur PostgREST (cache schéma, colonnes absentes…) pour retenter un insert sans
 * personal / audience / description. Ex. : « Could not find the 'audience' column … in the schema cache »
 * ne matche pas « column … audience » car l'ordre des mots diffère.
 */
function shouldRetryCalendarInsertWithoutAudienceFields(
  msg: string | undefined,
): boolean {
  if (!msg) return false;
  if (/could not find.*\b(audience|personal)\b.*\bcolumn\b/i.test(msg))
    return true;
  if (/schema cache/i.test(msg) && /\b(audience|personal)\b/i.test(msg))
    return true;
  if (/column .*personal/i.test(msg) || /column .*audience/i.test(msg))
    return true;
  if (/pgrst/i.test(msg) && /\b(audience|personal)\b/i.test(msg))
    return true;
  return false;
}

async function insertPersonalCalendarWithRetries(
  client: SupabaseClient,
  row: Record<string, unknown>,
  legacyMinimal: Record<string, unknown>,
): Promise<Error | null> {
  let { error } = await client.from("calendar_events").insert(row);
  if (error?.message?.toLowerCase().includes("description")) {
    const { description: _omit, ...noDesc } = row as Record<string, unknown>;
    ({ error } = await client.from("calendar_events").insert(noDesc));
  }

  if (error && shouldRetryCalendarInsertWithoutAudienceFields(error.message)) {
    ({ error } = await client.from("calendar_events").insert(legacyMinimal));
  }

  return error;
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

  if (!input.startsAt.trim() || !input.endsAt.trim()) {
    return { ok: false as const, error: "DATES_REQUIRED" as const };
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

  const client = await calendarWriteClientPreferAdmin();
  if (!client) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const kind = parseKind(input.kind ?? "school_event");

  const insertRow: Record<string, unknown> = {
    title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    kind,
    personal: true,
    audience: null,
    description: input.description?.trim() || null,
    created_by: user.id,
    class_id: null,
    teacher_id: null,
  };

  const legacy = {
    title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    kind,
    created_by: user.id,
    class_id: null as string | null,
    teacher_id: null as string | null,
  };

  const error = await insertPersonalCalendarWithRetries(
    client,
    insertRow,
    legacy,
  );

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

  if (!input.startsAt.trim() || !input.endsAt.trim()) {
    return { ok: false as const, error: "DATES_REQUIRED" as const };
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

  if (error && /description/i.test(error.message ?? "")) {
    const { description: _d, ...rowNoDesc } = insertRow;
    ins = await admin
      .from("calendar_events")
      .insert(rowNoDesc)
      .select("id")
      .maybeSingle();
    error = ins.error;
    rowId = ins.data?.id as string | undefined;
  }

  const missingNewCols =
    error && shouldRetryCalendarInsertWithoutAudienceFields(error.message);

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

export async function updateCalendarEventAction(
  locale: AppLocale,
  eventId: string,
  input: {
    title: string;
    startsAt: string;
    endsAt: string;
    description?: string;
    kind?: string;
  },
) {
  const user = await getSessionUser();
  const id = eventId.trim();
  if (!user || !UUID_RE.test(id)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  if (!input.startsAt.trim() || !input.endsAt.trim()) {
    return { ok: false as const, error: "DATES_REQUIRED" as const };
  }

  const db = await calendarWriteClientPreferAdmin();
  if (!db) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const sel = await db
    .from("calendar_events")
    .select("id,personal,created_by")
    .eq("id", id)
    .maybeSingle();

  type PickRow = { personal: boolean | null; created_by: string | null };

  let row = sel.data as PickRow | null;
  let perr = sel.error;
  if (perr?.message?.includes("personal")) {
    const fb = await db
      .from("calendar_events")
      .select("id,created_by")
      .eq("id", id)
      .maybeSingle();
    row = fb.data
      ? {
          personal: false,
          created_by: (fb.data as { created_by: string | null }).created_by,
        }
      : null;
    perr = fb.error as typeof perr;
  }

  if (perr || !row) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  const isPersonal = !!row.personal;
  const isOwner = row.created_by === user.id;
  const canEditSchool = !isPersonal && isStaffAdmin(user);
  if (!((isPersonal && isOwner) || canEditSchool)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
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

  const patch: Record<string, unknown> = {
    title,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    kind: parseKind(input.kind ?? "school_event"),
  };
  if (input.description !== undefined) {
    patch.description = input.description.trim() || null;
  }

  let { error: uerr } = await db.from("calendar_events").update(patch).eq("id", id);

  if (uerr && /description/i.test(uerr.message ?? "")) {
    const { description: _x, ...p2 } = patch;
    ({ error: uerr } = await db.from("calendar_events").update(p2).eq("id", id));
  }

  if (uerr) {
    console.error("calendar update", uerr.message);
    return { ok: false as const, error: "UPDATE_FAILED" as const };
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

  const db = await calendarWriteClientPreferAdmin();
  if (!db) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const sel = await db
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
    const fb = await db
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

  await db.from("calendar_event_targets").delete().eq("event_id", id);
  const { error } = await db.from("calendar_events").delete().eq("id", id);
  if (error) {
    return { ok: false as const, error: "DELETE_FAILED" as const };
  }

  revalidateCalendarViews(locale);
  return { ok: true as const };
}
