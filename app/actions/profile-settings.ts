"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session-server";

export async function updateMyProfileAction(
  locale: AppLocale,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    bio: string;
    phone: string;
  },
) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "NO_SESSION" as const };

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false as const, error: "NO_DB" as const };

  const email = input.email.trim();
  const patch: Record<string, unknown> = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    email: email.length ? email : null,
    bio: input.bio.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase
    .from("profiles")
    .update({ ...patch, phone: input.phone.trim() || null })
    .eq("id", user.id);

  if (error && error.message?.toLowerCase().includes("phone")) {
    ({ error } = await supabase.from("profiles").update(patch).eq("id", user.id));
  }

  if (error) return { ok: false as const, error: error.message };

  if (email.length) {
    const { error: authErr } = await supabase.auth.updateUser({ email });
    if (authErr) return { ok: false as const, error: authErr.message };
  }

  revalidatePath(`/${locale}/parametres`);
  revalidatePath(`/${locale}/profil/${user.id}`);
  return { ok: true as const };
}

export async function changeMyPasswordAction(input: {
  currentPassword: string;
  nextPassword: string;
}) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "NO_SESSION" as const };

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false as const, error: "NO_DB" as const };

  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (signErr) {
    return { ok: false as const, error: "BAD_CURRENT_PASSWORD" as const };
  }

  const { error } = await supabase.auth.updateUser({
    password: input.nextPassword,
  });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}

export async function updateProfileLocaleAction(
  locale: AppLocale,
  siteLocale: "fr" | "en",
) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "NO_SESSION" as const };

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false as const, error: "NO_DB" as const };

  const { error } = await supabase
    .from("profiles")
    .update({
      locale: siteLocale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error && error.message?.toLowerCase().includes("locale")) {
    return { ok: true as const };
  }
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/${locale}/parametres`);
  return { ok: true as const };
}
