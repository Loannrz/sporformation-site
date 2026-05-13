import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_ANNOUNCEMENTS } from "@/lib/mock-data";
import { hasPermission } from "@/lib/permissions";
import { readSessionCookie } from "@/lib/session-server";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AnnouncementsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await readSessionCookie();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "announcements",
  });
  const dateLocale = params.locale === "fr" ? fr : enUS;
  const canCreate = user && hasPermission(user, "CREATE_ANNOUNCEMENTS");

  const items = [...MOCK_ANNOUNCEMENTS].sort((a, b) => {
    if (a.importance === b.importance) {
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    return a.importance === "urgent" ? -1 : 1;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        {!canCreate && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("onlyDirectorCreate")}
          </p>
        )}
      </div>
      <div className="space-y-4">
        {items.map((a) => (
          <Card key={a.id} className="border-border/80">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={a.importance === "urgent" ? "urgent" : "secondary"}
                >
                  {a.importance}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(a.createdAt), "PPP", { locale: dateLocale })}
                </span>
              </div>
              <CardTitle>{a.title}</CardTitle>
              <CardDescription>Direction</CardDescription>
            </CardHeader>
            <CardContent
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: a.html }}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
