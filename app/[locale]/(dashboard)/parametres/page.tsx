import { SettingsTabs } from "@/components/settings/settings-tabs";
import { getSessionUser } from "@/lib/session-server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AppLocale } from "@/i18n/routing";

export default async function SettingsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user) return null;

  let phone = "";
  const supabase = await createServerSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    phone =
      data && typeof (data as { phone?: string }).phone === "string"
        ? (data as { phone: string }).phone
        : "";
  }

  return (
    <SettingsTabs user={user} locale={params.locale} initialPhone={phone} />
  );
}
