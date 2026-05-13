import { createServerSupabase } from "@/lib/supabase/server";
import type { CustomSchoolRole, PermissionKey } from "@/types";

export async function fetchCustomRolesOrdered(): Promise<CustomSchoolRole[]> {
  const supabase = await createServerSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("custom_roles")
    .select("id,parent_id,sort_order,name_fr,name_en,permissions")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    nameFr: row.name_fr,
    nameEn: row.name_en,
    parentRoleId: row.parent_id,
    permissions: (row.permissions ?? {}) as Partial<Record<PermissionKey, boolean>>,
  }));
}
