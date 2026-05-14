"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session-server";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import type { AppLocale } from "@/i18n/routing";
import type { SanctionType } from "@/types";
import { SANCTION_FORM_TYPES_ORDER } from "@/lib/discipline-types";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";

async function db() {
  return createAdminSupabase() ?? (await createServerSupabase());
}

function revalidateSanctionsHubPaths(locale: AppLocale) {
  revalidatePath(`/${locale}/sanctions`);
  revalidatePath(`/${locale}/admin/sanctions`);
}

function isSanctionType(raw: string): raw is SanctionType {
  return (SANCTION_FORM_TYPES_ORDER as readonly string[]).includes(raw);
}

export async function markAdminSanctionsSeenAction(
  locale: AppLocale,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { error } = await supabase
    .from("profiles")
    .update({
      admin_sanctions_last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidateSanctionsHubPaths(locale);
  return { ok: true };
}

export async function updateSanctionStaffAdminAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";
  const sanctionId = String(formData.get("sanctionId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const titleRaw = String(formData.get("title") ?? "").trim();

  if (!sanctionId || !studentId || !description || description.length < 4) {
    return { ok: false, error: "INVALID" };
  }
  if (!isSanctionType(typeRaw)) {
    return { ok: false, error: "INVALID_TYPE" };
  }

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { data: row, error: fetchErr } = await supabase
    .from("sanctions")
    .select("id,student_id,status")
    .eq("id", sanctionId)
    .maybeSingle();

  if (
    fetchErr ||
    !row ||
    row.student_id !== studentId ||
    row.status !== "active"
  ) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const { error: updErr } = await supabase
    .from("sanctions")
    .update({
      type: typeRaw,
      description,
      title: titleRaw.length ? titleRaw.slice(0, 240) : null,
    })
    .eq("id", sanctionId);

  if (updErr) return { ok: false, error: updErr.message };

  await logActivity({
    ...actorFromSession(user),
    action: "SANCTION_UPDATED",
    entityType: "sanction",
    entityId: sanctionId,
    meta: {
      student_id: studentId,
      sanction_type: typeRaw,
      title: titleRaw.length ? titleRaw.slice(0, 120) : null,
    },
  });

  revalidateSanctionsHubPaths(locale);
  revalidatePath(`/${locale}/etudiants/${studentId}`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}

export async function retireSanctionStaffAdminAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";
  const sanctionId = String(formData.get("sanctionId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { data: row, error: fetchErr } = await supabase
    .from("sanctions")
    .select("id,student_id,status")
    .eq("id", sanctionId)
    .maybeSingle();

  if (
    fetchErr ||
    !row ||
    row.student_id !== studentId ||
    row.status !== "active"
  ) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const { error: updErr } = await supabase
    .from("sanctions")
    .update({
      status: "retired",
      retired_at: new Date().toISOString(),
      retired_by: user.id,
    })
    .eq("id", sanctionId);

  if (updErr) return { ok: false, error: updErr.message };

  await logActivity({
    ...actorFromSession(user),
    action: "SANCTION_RETIRED",
    entityType: "sanction",
    entityId: sanctionId,
    meta: { student_id: studentId },
  });

  revalidateSanctionsHubPaths(locale);
  revalidatePath(`/${locale}/etudiants/${studentId}`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}

export async function deleteSanctionDirectorAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    return { ok: false, error: "FORBIDDEN" };
  }

  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";
  const sanctionId = String(formData.get("sanctionId") ?? "").trim();
  const studentId = String(formData.get("studentId") ?? "").trim();

  const admin = createAdminSupabase();
  const supabase = admin ?? (await createServerSupabase());
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { data: row, error: fetchErr } = await supabase
    .from("sanctions")
    .select("id,student_id")
    .eq("id", sanctionId)
    .maybeSingle();

  if (fetchErr || !row || row.student_id !== studentId) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const { error: delErr } = await supabase
    .from("sanctions")
    .delete()
    .eq("id", sanctionId);

  if (delErr) return { ok: false, error: delErr.message };

  await logActivity({
    ...actorFromSession(user),
    action: "SANCTION_DELETED",
    entityType: "sanction",
    entityId: sanctionId,
    meta: { student_id: studentId },
  });

  revalidateSanctionsHubPaths(locale);
  revalidatePath(`/${locale}/etudiants/${studentId}`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}
