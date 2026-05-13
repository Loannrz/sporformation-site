import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** À utiliser dans les Server Actions / Routes API une fois Supabase configuré (voir README). */
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
