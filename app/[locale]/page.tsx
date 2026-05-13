import { redirect } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { readSessionCookie } from "@/lib/session-server";

export default async function LocaleHomePage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await readSessionCookie();
  if (user) {
    redirect({ href: "/dashboard", locale: params.locale });
  }
  redirect({ href: "/login", locale: params.locale });
}
