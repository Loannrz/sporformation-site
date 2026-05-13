import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MOCK_CONVERSATIONS, allStaff } from "@/lib/mock-data";
import type { AppLocale } from "@/i18n/routing";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";

export default async function MessagingIndexPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "messaging",
  });
  const dfLocale = params.locale === "fr" ? fr : enUS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ScrollArea className="h-[640px] rounded-2xl border border-border bg-card/60">
        <div className="divide-y divide-border">
          {MOCK_CONVERSATIONS.map((c) => (
            <Link
              key={c.id}
              href={`/messagerie/${c.id}`}
              className="block px-5 py-4 transition hover:bg-muted/40"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {c.isGroup
                      ? c.name
                      : "Conversation directe"}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {c.lastMessageSnippet}
                  </p>
                </div>
                <Badge variant="secondary" className="whitespace-nowrap">
                  {formatDistanceToNow(new Date(c.updatedAt), {
                    addSuffix: true,
                    locale: dfLocale,
                  })}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </ScrollArea>
      <p className="text-xs text-muted-foreground">{t("unreadDigest")}</p>
      <p className="text-xs text-muted-foreground">
        {allStaff.length} collaborateurs indexés (démo).
      </p>
    </div>
  );
}
