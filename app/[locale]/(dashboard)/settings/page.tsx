import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default function SettingsRedirect({
  params,
}: {
  params: { locale: AppLocale };
}) {
  redirect({ href: "/parametres", locale: params.locale });
}
