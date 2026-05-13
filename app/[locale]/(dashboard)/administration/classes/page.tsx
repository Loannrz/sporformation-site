import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { readSessionCookie } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminClassesPage({
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
        <h1 className="text-3xl font-semibold">{t("classesTitle")}</h1>
        <p className="text-muted-foreground">
          Création/renommage/suppression + affectation prof principal (RLS à
          activer côté Supabase).
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {MOCK_CLASSES.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {c.studentIds.length} étudiants indexés
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
