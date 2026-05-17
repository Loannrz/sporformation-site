import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConnectionConfig } from "@/lib/supabase/env";

/** Client lecture / session côté serveur (layouts, Server Components). L’écriture des cookies se fait dans le middleware ou via une Route Handler — voir `setAll`. */
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
        try {
          next.forEach((c) =>
            cookieStore.set(c.name, c.value, c.options ?? {}),
          );
        } catch {
          /**
           * `cookies().set` n’est pas autorisé pendant le rendu d’un Server Component —
           * uniquement dans une Route Handler / Server Action. Supabase peut tenter une
           * mise à jour de session après `getUser()` / lecture ; le middleware rafraîchit déjà les cookies (voir `copySupabaseSessionToResponse`).
           */
        }
      },
    },
  });
}
