"use server";

import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AppLocale } from "@/i18n/routing";
import {
  initialSignInState,
  type SignInFormState,
} from "@/lib/auth/sign-in-form-state";

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

function mapSupabaseAuthError(err: {
  message: string;
  status?: number;
}): { code: string; dev: string | null } {
  const isDev = process.env.NODE_ENV === "development";
  const dev = isDev
    ? [err.message, err.status ? `HTTP ${err.status}` : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  const m = err.message.toLowerCase();
  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid email or password") ||
    m.includes("invalid credentials")
  ) {
    return { code: "INVALID_CREDENTIALS", dev };
  }
  if (m.includes("email not confirmed")) {
    return { code: "EMAIL_NOT_CONFIRMED", dev };
  }
  if (err.status === 429 || m.includes("too many") || m.includes("rate limit")) {
    return { code: "RATE_LIMITED", dev };
  }
  if (m.includes("user not found") || m.includes("user banned")) {
    return { code: "ACCOUNT_BLOCKED", dev };
  }
  return { code: "GENERIC", dev };
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

function unreachableDevDetail(e: unknown): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  if (!(e instanceof Error)) return String(e);
  const c = e.cause;
  if (c instanceof Error) return `${e.message} — ${c.message}`;
  return e.message;
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
    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (isNetworkLikeAuthMessage(error.message)) {
        return {
          errorCode: "BAD_URL",
          devDetail:
            process.env.NODE_ENV === "development" ? error.message : null,
        };
      }
      const { code, dev } = mapSupabaseAuthError(error);
      return { errorCode: code, devDetail: dev };
    }
  } catch (e: unknown) {
    if (isSupabaseUnreachableError(e)) {
      return {
        errorCode: "BAD_URL",
        devDetail: unreachableDevDetail(e),
      };
    }
    return {
      errorCode: "GENERIC",
      devDetail:
        process.env.NODE_ENV === "development" && e instanceof Error
          ? e.message
          : null,
    };
  }

  redirect({ href: "/dashboard", locale });
  return initialSignInState;
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
