import { createClient } from "@supabase/supabase-js";
import { getSupabaseConnectionConfig } from "@/lib/supabase/env";

/** Client service_role : jamais importé dans un composant client. */
export function createAdminSupabase() {
  const { url } = getSupabaseConnectionConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
