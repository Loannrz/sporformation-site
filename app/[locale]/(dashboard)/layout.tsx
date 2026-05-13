import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { AppLocale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session-server";
import { redirect } from "@/i18n/navigation";

export default async function DashboardGroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (user) {
    return <DashboardShell user={user}>{children}</DashboardShell>;
  }

  const supabase = await createServerSupabase();
  if (supabase) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      redirect({
        href: "/login?error=need_profile",
        locale: params.locale,
      });
    }
  }

  redirect({ href: "/login", locale: params.locale });
}
