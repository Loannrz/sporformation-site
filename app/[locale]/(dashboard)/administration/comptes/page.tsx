import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { allStaff } from "@/lib/mock-data";
import { readSessionCookie } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminAccountsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await readSessionCookie();
  if (!user || user.role !== "DIRECTEUR") {
    notFound();
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("accountsTitle")}</h1>
        <p className="text-muted-foreground">
          Invitations email + reset mot de passe via Resend & Supabase Auth.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {allStaff.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>
                {s.firstName} {s.lastName}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{s.email}</p>
              <p className="mt-2 font-medium text-foreground">{s.role}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
