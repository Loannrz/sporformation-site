import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import type { AppLocale } from "@/i18n/routing";

/** Module retiré du hub : redirection pour les anciens liens. */
export default async function AdminRolesRedirectPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }
  redirect({ href: "/admin", locale: params.locale });
}
