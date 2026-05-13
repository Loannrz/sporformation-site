"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session-server";

export async function reorderRolesAction(
  locale: AppLocale,
  orderedIds: string[],
) {
  const user = await getSessionUser();
  if (!user || user.role !== "DIRECTEUR") {
    return { ok: false as const, error: "FORBIDDEN" };
  }
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false as const, error: "NO_DB" };

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("custom_roles")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath(`/${locale}/administration/roles`);
  return { ok: true as const };
}
