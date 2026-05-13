"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { reorderCustomRoles } from "@/lib/mock-data";

export async function reorderRolesAction(
  locale: AppLocale,
  orderedIds: string[],
) {
  reorderCustomRoles(orderedIds);
  revalidatePath(`/${locale}/administration/roles`);
}
