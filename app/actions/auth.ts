"use server";

import { cookies } from "next/headers";
import { routing } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { getPresetUser } from "@/lib/mock-data";
import { encodeSessionUser } from "@/lib/session-server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import type { AppLocale } from "@/i18n/routing";
import type { SessionUser } from "@/types";

export async function devSignIn(formData: FormData) {
  const role = formData.get("role") as SessionUser["role"];
  const localeRaw = formData.get("locale") as string;
  const locale: AppLocale = routing.locales.includes(localeRaw as AppLocale)
    ? (localeRaw as AppLocale)
    : routing.defaultLocale;
  const allowed: SessionUser["role"][] = [
    "DIRECTEUR",
    "PROF_PRINCIPAL",
    "PROFESSEUR",
  ];
  if (!allowed.includes(role)) {
    redirect({ href: "/login", locale: locale ?? "fr" });
  }
  const user = getPresetUser(role);
  cookies().set(SESSION_COOKIE_NAME, encodeSessionUser(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect({ href: "/dashboard", locale });
}

export async function signOutAction(formData: FormData) {
  const raw = formData.get("locale") as string | null;
  const locale: AppLocale = raw && routing.locales.includes(raw as AppLocale)
    ? (raw as AppLocale)
    : routing.defaultLocale;
  cookies().delete(SESSION_COOKIE_NAME);
  redirect({ href: "/login", locale });
}
