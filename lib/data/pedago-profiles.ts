import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  mergePedagoAdminFromDb,
  mergePedagoNavFromDb,
} from "@/lib/pedago-access";
import type { PedagoAdminFlagKey, PedagoNavFlagKey } from "@/types";

export type PedagoProfileRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string | null;
  nav: Record<PedagoNavFlagKey, boolean>;
  admin: Record<PedagoAdminFlagKey, boolean>;
};

export async function fetchPedagoProfilesForDirector(): Promise<PedagoProfileRow[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];

  const sel =
    "id,email,first_name,last_name,joined_at,pedago_nav_flags,pedago_admin_flags";
  const { data, error } = await admin
    .from("profiles")
    .select(sel)
    .eq("base_role", "PEDAGO")
    .order("last_name", { ascending: true });

  if (error || !data?.length) return [];

  return (
    data as {
      id: string;
      email: string | null;
      first_name: string;
      last_name: string;
      joined_at: string | null;
      pedago_nav_flags?: unknown;
      pedago_admin_flags?: unknown;
    }[]
  ).map((row) => ({
    id: row.id,
    email: row.email ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.joined_at ?? null,
    nav: mergePedagoNavFromDb(row.pedago_nav_flags),
    admin: mergePedagoAdminFromDb(row.pedago_admin_flags),
  }));
}
