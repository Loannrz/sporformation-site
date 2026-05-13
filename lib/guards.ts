import type { AppLocale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";

export function redirectToAccessDenied(locale: AppLocale): never {
  redirect({ href: "/acces-refuse", locale });
  throw new Error("unreachable");
}
