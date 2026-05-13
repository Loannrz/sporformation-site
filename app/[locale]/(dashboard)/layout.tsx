import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";
import { readSessionCookie } from "@/lib/session-server";
import { redirect } from "@/i18n/navigation";

export default async function DashboardGroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: AppLocale };
}) {
  const user = await readSessionCookie();
  if (!user) {
    return redirect({ href: "/login", locale: params.locale });
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
