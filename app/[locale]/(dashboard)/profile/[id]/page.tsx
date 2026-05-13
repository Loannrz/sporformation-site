import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

export default function ProfileAliasRedirect({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  redirect({ href: `/profil/${params.id}`, locale: params.locale });
}
