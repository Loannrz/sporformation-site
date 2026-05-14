import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppLocale } from "@/i18n/routing";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getSessionUser } from "@/lib/session-server";
import { redirect } from "@/i18n/navigation";
import { hasPermission } from "@/lib/permissions";
import {
  fetchMessagingConversationsList,
  fetchMessagingDirectoryPeople,
} from "@/lib/data/messaging";
import { MessagingNewDiscussionButton } from "@/components/messaging/messaging-new-discussion-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function MessagingIndexPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect({ href: "/dashboard", locale: params.locale });
    throw new Error("Unreachable");
  }
  if (!hasPermission(sessionUser, "SEND_MESSAGES")) {
    redirect({ href: "/dashboard", locale: params.locale });
    throw new Error("Unreachable");
  }
  const user = sessionUser;

  const t = await getTranslations({
    locale: params.locale,
    namespace: "messaging",
  });
  const dfLocale = params.locale === "fr" ? fr : enUS;
  const loc = params.locale === "fr" ? "fr" : "en";

  const [conversations, directory] = await Promise.all([
    fetchMessagingConversationsList(user.id, loc),
    fetchMessagingDirectoryPeople(user.id, loc, user.role !== "ELEVE"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="max-w-xl text-base text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <MessagingNewDiscussionButton locale={params.locale} directory={directory} />
      </div>

      <ScrollArea className="h-[min(640px,70vh)] rounded-2xl border-2 border-border bg-card shadow-sm">
        <ul className="divide-y divide-border">
          {conversations.length === 0 ? (
            <li className="px-5 py-16 text-center text-muted-foreground">
              <p className="text-base font-medium text-foreground">
                {t("inboxEmptyTitle")}
              </p>
              <p className="mt-2 text-sm">{t("inboxEmptyHint")}</p>
            </li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/messagerie/${c.id}`}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {!c.isGroup && c.peerAvatarUrl ? (
                    <Avatar className="mt-0.5 h-11 w-11 shrink-0 border border-border shadow-sm">
                      <AvatarImage src={c.peerAvatarUrl} alt="" />
                      <AvatarFallback className="text-xs font-semibold">
                        {c.title.trim().slice(0, 2).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className="mt-0.5 h-11 w-11 shrink-0 border border-dashed border-muted-foreground/35 bg-muted/30">
                      <AvatarFallback className="bg-transparent text-[11px] font-bold text-muted-foreground">
                        {c.isGroup
                          ? "#"
                          : c.title.trim().slice(0, 2).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold leading-tight">
                        {c.title}
                      </p>
                      {c.unreadCount > 0 ? (
                        <Badge
                          variant="default"
                          className="h-6 min-w-6 justify-center rounded-full px-2 text-xs font-bold"
                          aria-label={t("unreadCountAria", {
                            count: c.unreadCount,
                          })}
                        >
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {c.lastMessageSnippet ?? t("noMessagesYet")}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={c.lastMessageAt ?? undefined}
                  >
                    {c.lastMessageAt
                      ? formatDistanceToNow(new Date(c.lastMessageAt), {
                          addSuffix: true,
                          locale: dfLocale,
                        })
                      : "—"}
                  </time>
                </Link>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}
