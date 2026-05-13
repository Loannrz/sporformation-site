import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConnectionConfig } from "@/lib/supabase/env";

/** À utiliser dans les Server Actions / Routes API une fois Supabase configuré (voir README). */
export async function createServerSupabase() {
  const { url, anonKey: anon } = getSupabaseConnectionConfig();
  if (!url || !anon) return null;

  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(next) {
        next.forEach((c) =>
          cookieStore.set(c.name, c.value, c.options ?? {}),
        );
      },
    },
  });
}
