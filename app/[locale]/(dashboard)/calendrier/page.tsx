import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MOCK_EVENTS } from "@/lib/mock-data";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function CalendarPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "calendar",
  });
  const localeObj = params.locale === "fr" ? fr : enUS;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <p className="mt-3 text-xs text-muted-foreground">{t("addEventHint")}</p>
      </div>

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">{t("monthly")}</TabsTrigger>
          <TabsTrigger value="week">{t("weekly")}</TabsTrigger>
          <TabsTrigger value="day">{t("daily")}</TabsTrigger>
        </TabsList>
        {(["month", "week", "day"] as const).map((v) => (
          <TabsContent key={v} value={v} className="mt-6">
            <CalendarGridPlaceholder label={`Vue ${v}`} />
          </TabsContent>
        ))}
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Mini agenda</CardTitle>
          <CardDescription>{t("timetableClass")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {MOCK_EVENTS.map((ev) => (
            <article
              key={ev.id}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <p className="text-sm font-semibold">{ev.title}</p>
              <p className="text-xs text-muted-foreground">
                {ev.type.toUpperCase()} ·{" "}
                {format(new Date(ev.start), "EEEE d · HH:mm", {
                  locale: localeObj,
                })}{" "}
                → {format(new Date(ev.end), "HH:mm", { locale: localeObj })}
              </p>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarGridPlaceholder({ label }: { label: string }) {
  return (
    <div className="grid h-[420px] place-items-center rounded-2xl border border-dashed border-border bg-muted/20 text-muted-foreground">
      <p>{label} · connectez vos événements Supabase pour remplacer ce squelette.</p>
    </div>
  );
}
