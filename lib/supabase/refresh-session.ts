import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseConnectionConfig } from "@/lib/supabase/env";

/** Rafraîchit le JWT Supabase et recopie les cookies sur la réponse (à utiliser après next-intl). */
export async function copySupabaseSessionToResponse(
  request: NextRequest,
  response: NextResponse,
) {
  const { url, anonKey: anon } = getSupabaseConnectionConfig();
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
