"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { AppLocale } from "@/i18n/routing";
import {
  initialSignInState,
  type SignInFormState,
} from "@/lib/auth/sign-in-form-state";
import { logActivity } from "@/lib/data/activity-logs";

const emailLooksValid = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/** GoTrue renvoie parfois { error } avec message réseau sans lever d’exception. */
function isNetworkLikeAuthMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("getaddrinfo")
  );
}

/** Messages GoTrue/localisés côté client : on ne renvoie que des codes, jamais de détail brut à l’écran connexion. */
function mapSupabaseAuthError(err: { message: string; status?: number }): string {
  const m = err.message.toLowerCase();
  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid email or password") ||
    m.includes("invalid credentials") ||
    m.includes("user not found")
  ) {
    return "INVALID_CREDENTIALS";
  }
  if (m.includes("invalid email") || m.includes("unable to validate email")) {
    return "INVALID_EMAIL_FORMAT";
  }
  if (m.includes("email not confirmed")) {
    return "EMAIL_NOT_CONFIRMED";
  }
  if (
    err.status === 429 ||
    m.includes("too many") ||
    m.includes("rate limit") ||
    m.includes("email rate limit")
  ) {
    return "RATE_LIMITED";
  }
  if (m.includes("user banned") || m.includes("banned")) {
    return "ACCOUNT_BLOCKED";
  }
  return "GENERIC";
}

function isSupabaseUnreachableError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (isNetworkLikeAuthMessage(e.message)) return true;
  const c = e.cause;
  if (
    c &&
    typeof c === "object" &&
    "code" in c &&
    typeof (c as { code?: string }).code === "string"
  ) {
    const code = (c as { code: string }).code;
    return (
      code === "ENOTFOUND" ||
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT"
    );
  }
  return false;
}

/**
 * Journalise une connexion : tente d'identifier le profil ou la fiche élève
 * pour distinguer la toute première connexion (`AUTH_SIGN_IN_FIRST`) du retour
 * en se basant sur les traces déjà présentes dans `activity_logs`.
 */
async function recordSignInActivity(
  userId: string | null,
  emailLower: string,
): Promise<void> {
  try {
    const admin = createAdminSupabase();
    if (!admin || !userId) return;

    let actorLabel: string | null = null;
    let actorRole: string | null = null;

    const { data: profile } = await admin
      .from("profiles")
      .select("first_name,last_name,base_role")
      .eq("id", userId)
      .maybeSingle();

    if (profile) {
      const p = profile as {
        first_name?: string | null;
        last_name?: string | null;
        base_role?: string | null;
      };
      actorLabel = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || emailLower;
      actorRole = p.base_role ?? null;
    } else {
      const { data: student } = await admin
        .from("students")
        .select("first_name,last_name")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (student) {
        const s = student as {
          first_name?: string | null;
          last_name?: string | null;
        };
        actorLabel = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || emailLower;
        actorRole = "ELEVE";
      }
    }

    const { data: prior } = await admin
      .from("activity_logs")
      .select("id")
      .eq("actor_id", userId)
      .in("action", ["AUTH_SIGN_IN", "AUTH_SIGN_IN_FIRST"])
      .limit(1);
    const isFirst = !prior || prior.length === 0;

    await logActivity({
      actorId: userId,
      actorLabel,
      actorRole,
      action: isFirst ? "AUTH_SIGN_IN_FIRST" : "AUTH_SIGN_IN",
      entityType: "auth_user",
      entityId: userId,
      meta: { email: emailLower },
    });
  } catch {
    // logging silencieux
  }
}

export async function signInWithPasswordAction(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const localeRaw = formData.get("locale") as string;
  const locale: AppLocale = routing.locales.includes(localeRaw as AppLocale)
    ? (localeRaw as AppLocale)
    : routing.defaultLocale;

  if (!email) {
    return {
      errorCode: "EMAIL_REQUIRED",
      devDetail: null,
    };
  }
  if (!emailLooksValid(email)) {
    return {
      errorCode: "INVALID_EMAIL_FORMAT",
      devDetail: null,
    };
  }
  if (!password) {
    return {
      errorCode: "PASSWORD_REQUIRED",
      devDetail: null,
    };
  }

  const client = await createServerSupabase();
  if (!client) {
    return { errorCode: "CONFIG", devDetail: null };
  }

  try {
    const { data: signInData, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (isNetworkLikeAuthMessage(error.message)) {
        return {
          errorCode: "BAD_URL",
          devDetail: null,
        };
      }
      return { errorCode: mapSupabaseAuthError(error), devDetail: null };
    }

    await recordSignInActivity(signInData?.user?.id ?? null, email);
  } catch (e: unknown) {
    if (isSupabaseUnreachableError(e)) {
      return {
        errorCode: "BAD_URL",
        devDetail: null,
      };
    }
    return {
      errorCode: "GENERIC",
      devDetail: null,
    };
  }

  redirect({ href: "/dashboard", locale });
  return initialSignInState;
}

export async function completeFirstPasswordSetupAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "NO_USER" };

  const { data: prof } = await supabase
    .from("profiles")
    .select("teacher_employment_status")
    .eq("id", user.id)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    must_set_password: false,
    updated_at: new Date().toISOString(),
  };

  if (prof?.teacher_employment_status === "NEW_TO_SCHOOL") {
    patch.teacher_employment_status = "ACTIVE_AT_SCHOOL";
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);

  if (!error) {
    await logActivity({
      actorId: user.id,
      actorLabel: user.email ?? null,
      action: "AUTH_PASSWORD_FIRST_SET",
      entityType: "auth_user",
      entityId: user.id,
    });
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const { error: e2 } = await supabase
    .from("profiles")
    .update({
      must_set_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (e2) return { ok: false, error: error.message };

  await logActivity({
    actorId: user.id,
    actorLabel: user.email ?? null,
    action: "AUTH_PASSWORD_FIRST_SET",
    entityType: "auth_user",
    entityId: user.id,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction(formData: FormData) {
  const raw = formData.get("locale") as string | null;
  const locale: AppLocale = raw && routing.locales.includes(raw as AppLocale)
    ? (raw as AppLocale)
    : routing.defaultLocale;

  const supabase = await createServerSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect({ href: "/login", locale });
}
