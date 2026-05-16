import { PedagoUsersPanel } from "@/components/admin/pedago-users-panel";
import { fetchPedagoProfilesForDirector } from "@/lib/data/pedago-profiles";
import { redirectToAccessDenied } from "@/lib/guards";
import { isDirector } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-server";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function AdminPedagoUsersPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }

  const rows = await fetchPedagoProfilesForDirector();

  return <PedagoUsersPanel locale={params.locale} rows={rows} />;
}
