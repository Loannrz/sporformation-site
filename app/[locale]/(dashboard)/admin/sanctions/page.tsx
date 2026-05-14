import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Ancienne URL : le hub sanctions est accessible à tous les rôles concernés sous `/sanctions`. */
export default function AdminSanctionsRedirectPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  redirect({ href: "/sanctions", locale: params.locale });
}
