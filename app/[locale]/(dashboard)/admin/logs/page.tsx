import { fetchActivityLogsForDirector } from "@/lib/data/activity-logs";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";

export default async function AdminLogsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isDirector(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin.logs",
  });

  const { rows, error } = await fetchActivityLogsForDirector(200);
  const dfLocale = params.locale === "fr" ? fr : enUS;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        {error ? (
          <p className="mt-2 text-sm text-destructive">
            {t("loadError", { detail: error })}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={
            <Button type="button" variant="outline" asChild>
              <Link href="/admin">{t("backHub")}</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("tableTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t("colDate")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colAction")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("colEntity")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/80">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {format(new Date(r.created_at), "PPpp", { locale: dfLocale })}
                    </td>
                    <td className="py-2 pr-4">{r.action}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {r.entity_type ?? "—"}
                      {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
