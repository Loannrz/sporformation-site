import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import type { AppLocale } from "@/i18n/routing";

/** Ancienne entrée « Formations » : le hub admin la remplace. */
export default async function AdminProgramsRedirectPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }
  redirect({ href: "/admin", locale: params.locale });
}
