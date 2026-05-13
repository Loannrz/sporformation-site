"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Client navigateur après configuration des variables NEXT_PUBLIC_SUPABASE_*. Retourne null si non configuré. */
export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createBrowserClient(url, anon);
}
