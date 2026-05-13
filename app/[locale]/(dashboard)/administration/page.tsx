import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import type { AppLocale } from "@/i18n/routing";

/** Ancien hub : remplacé par `/admin` ; cette route redirige pour compatibilité des favoris. */
export default async function AdministrationHubRedirectPage({
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
