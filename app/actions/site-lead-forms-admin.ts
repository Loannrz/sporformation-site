"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/session-server";
import { canManageLeadForms } from "@/lib/pedago-access";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AppLocale } from "@/i18n/routing";

const ID_RE = /^\d+$/;

function revalidateLeadForms(locale: AppLocale) {
  revalidatePath(`/${locale}/admin`);
  revalidatePath(`/${locale}/admin/lead-forms`);
  /** Remet à jour la sidebar : le compteur est chargé dans le layout tableau de bord. */
  revalidatePath(`/${locale}/dashboard`);
}

export async function approveSiteLeadStudentAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("formulaires_etudiants")
    .update({
      statut: "approuve",
      approuve_at: now,
    })
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function approveSiteLeadEmployerAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("formulaires_employeurs")
    .update({
      statut: "approuve",
      approuve_at: now,
    })
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function markSiteLeadStudentContactedAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("formulaires_etudiants")
    .update({
      statut: "contacte",
      contacte_at: now,
    })
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function markSiteLeadEmployerContactedAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("formulaires_employeurs")
    .update({
      statut: "contacte",
      contacte_at: now,
    })
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function deleteSiteLeadStudentAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const { error } = await admin
    .from("formulaires_etudiants")
    .delete()
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function deleteSiteLeadEmployerAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const { error } = await admin
    .from("formulaires_employeurs")
    .delete()
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function approveSiteLeadTepAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("reservations_prepa_tep")
    .update({
      statut: "approuve",
      approuve_at: now,
    })
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function markSiteLeadTepContactedAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("reservations_prepa_tep")
    .update({
      statut: "contacte",
      contacte_at: now,
    })
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}

export async function deleteSiteLeadTepAction(
  locale: AppLocale,
  idRaw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !canManageLeadForms(user)) return { ok: false, error: "FORBIDDEN" };
  if (!ID_RE.test(idRaw)) return { ok: false, error: "INVALID_ID" };
  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const { error } = await admin
    .from("reservations_prepa_tep")
    .delete()
    .eq("id", Number(idRaw));

  if (error) return { ok: false, error: error.message };
  revalidateLeadForms(locale);
  return { ok: true };
}
