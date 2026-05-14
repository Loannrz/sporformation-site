import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import type { AppLocale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/session-server";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "@/i18n/navigation";
import {
  computeAverageResponseMinutes,
  fetchConversationMessages,
  fetchConversationParticipants,
  fetchMessagingConversationsList,
  userParticipatesInConversation,
} from "@/lib/data/messaging";
import { ConversationThreadClient } from "@/components/messaging/conversation-thread-client";

export default async function ConversationPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
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

  const ok = await userParticipatesInConversation(user.id, params.id);
  if (!ok) {
    notFound();
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "messaging",
  });
  const loc = params.locale === "fr" ? "fr" : "en";

  const [messages, participants, list] = await Promise.all([
    fetchConversationMessages(params.id),
    fetchConversationParticipants(params.id, loc),
    fetchMessagingConversationsList(user.id, loc),
  ]);

  const summary = list.find((c) => c.id === params.id);
  const title = summary?.title ?? t("fallbackTitle");
  const isGroup = summary?.isGroup ?? false;

  const avg = computeAverageResponseMinutes(messages);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/messagerie"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToInbox")}
      </Link>

      <ConversationThreadClient
        locale={params.locale}
        conversationId={params.id}
        currentUserId={user.id}
        title={title}
        isGroup={isGroup}
        initialMessages={messages}
        participants={participants}
        averageResponseMinutes={avg}
      />
    </div>
  );
}
