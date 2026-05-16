"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isProfilesExtendedColumnsUnavailable } from "@/lib/supabase/profile-columns";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import type { PedagoAdminFlagKey, PedagoNavFlagKey } from "@/types";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";

function generateProvisionalAuthSecret() {
  return `${randomBytes(28).toString("base64url")}Zz9!`;
}

function isAuthEmailTakenError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? "").toLowerCase();
  return m.includes("already been registered") || m.includes("already exists");
}

async function findAuthUserIdByEmail(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  for (let i = 0; i < 12; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if ((u.email ?? "").trim().toLowerCase() === normalized) return u.id;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

export async function createPedagoUserAction(
  locale: AppLocale,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    nav: Record<PedagoNavFlagKey, boolean>;
    admin: Record<PedagoAdminFlagKey, boolean>;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) return { ok: false, error: "FORBIDDEN" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const email = input.email.trim().toLowerCase();
  const fn = input.firstName.trim();
  const ln = input.lastName.trim();
  if (!email.includes("@") || !fn || !ln) {
    return { ok: false, error: "INVALID" };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id,base_role")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    return { ok: false, error: "EMAIL_IN_USE" };
  }

  const password = generateProvisionalAuthSecret();
  /** Mot de passe technique uniquement : la personne définit le sien via l’onglet « Mes premières connexions » sur la page de connexion. */
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  let id: string;
  if (created?.user?.id) {
    id = created.user.id;
  } else if (isAuthEmailTakenError(cErr)) {
    const existingId = await findAuthUserIdByEmail(admin, email);
    if (!existingId) return { ok: false, error: "AUTH_LOOKUP_FAILED" };
    const { data: p2 } = await admin.from("profiles").select("id").eq("id", existingId).maybeSingle();
    if (p2) return { ok: false, error: "EMAIL_IN_USE" };
    id = existingId;
  } else {
    return { ok: false, error: cErr?.message ?? "AUTH_CREATE_FAILED" };
  }

  const profileRow: Record<string, unknown> = {
    id,
    email,
    first_name: fn,
    last_name: ln,
    base_role: "PEDAGO",
    bio: null,
    subjects: [],
    principal_class_ids: [],
    assigned_class_ids: [],
    active_at_establishment: true,
    left_establishment_on: null,
    must_set_password: true,
    teacher_employment_status: "ACTIVE_AT_SCHOOL",
    pedago_nav_flags: input.nav,
    pedago_admin_flags: input.admin,
    joined_at: new Date().toISOString().slice(0, 10),
  };

  const { error: pErr } = await admin.from("profiles").insert(profileRow);

  if (pErr && isProfilesExtendedColumnsUnavailable(pErr)) {
    const legacy: Record<string, unknown> = {
      id,
      email,
      first_name: fn,
      last_name: ln,
      base_role: "PEDAGO",
      bio: null,
      subjects: [],
      principal_class_ids: [],
      joined_at: profileRow.joined_at,
    };
    const { error: lErr } = await admin.from("profiles").insert(legacy);
    if (lErr) {
      await admin.auth.admin.deleteUser(id);
      return { ok: false, error: lErr.message };
    }
  } else if (pErr) {
    await admin.auth.admin.deleteUser(id);
    return { ok: false, error: pErr.message };
  }

  await logActivity({
    ...actorFromSession(user),
    action: "STAFF_CREATED",
    entityType: "profile",
    entityId: id,
    entityLabel: `${fn} ${ln}`.trim(),
    meta: { email, target_role: "PEDAGO" },
  });

  revalidatePath(`/${locale}/admin/pedago-users`);
  revalidatePath(`/${locale}/admin`);
  return { ok: true, id };
}

export async function updatePedagoFlagsAction(
  locale: AppLocale,
  pedagoId: string,
  input: {
    nav: Record<PedagoNavFlagKey, boolean>;
    admin: Record<PedagoAdminFlagKey, boolean>;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) return { ok: false, error: "FORBIDDEN" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const { data: row, error: fetchErr } = await admin
    .from("profiles")
    .select("id,base_role")
    .eq("id", pedagoId)
    .maybeSingle();

  if (fetchErr || !row || row.base_role !== "PEDAGO") {
    return { ok: false, error: "NOT_FOUND" };
  }

  const { error: uErr } = await admin
    .from("profiles")
    .update({
      pedago_nav_flags: input.nav,
      pedago_admin_flags: input.admin,
    })
    .eq("id", pedagoId);

  if (uErr) return { ok: false, error: uErr.message };

  await logActivity({
    ...actorFromSession(user),
    action: "STAFF_UPDATED",
    entityType: "profile",
    entityId: pedagoId,
    meta: { pedago_flags: true },
  });

  revalidatePath(`/${locale}/admin/pedago-users`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}

export async function deletePedagoUserAction(
  locale: AppLocale,
  pedagoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) return { ok: false, error: "FORBIDDEN" };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_ADMIN" };

  const { data: row } = await admin
    .from("profiles")
    .select("id,base_role")
    .eq("id", pedagoId)
    .maybeSingle();

  if (!row || row.base_role !== "PEDAGO") {
    return { ok: false, error: "NOT_FOUND" };
  }

  const { error: dErr } = await admin.from("profiles").delete().eq("id", pedagoId);
  if (dErr) return { ok: false, error: dErr.message };

  await admin.auth.admin.deleteUser(pedagoId);

  await logActivity({
    ...actorFromSession(user),
    action: "STAFF_DELETED",
    entityType: "profile",
    entityId: pedagoId,
    meta: { role: "PEDAGO" },
  });

  revalidatePath(`/${locale}/admin/pedago-users`);
  revalidatePath(`/${locale}/admin`);
  return { ok: true };
}
