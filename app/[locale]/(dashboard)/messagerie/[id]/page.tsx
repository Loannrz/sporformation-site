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
  fetchConversationGroupMeta,
  fetchConversationMessages,
  fetchConversationParticipants,
  fetchMessagingConversationsList,
  fetchMessagingDirectoryPeople,
  userParticipatesInConversation,
} from "@/lib/data/messaging";
import { messagingDirectPeerProfileHref } from "@/lib/messaging-profile-link";
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

  let groupMeta: Awaited<ReturnType<typeof fetchConversationGroupMeta>> = null;
  let directoryPeople: Awaited<ReturnType<
    typeof fetchMessagingDirectoryPeople
  >> | undefined;
  if (isGroup) {
    const pack = await Promise.all([
      fetchConversationGroupMeta(params.id),
      fetchMessagingDirectoryPeople(user.id, loc, user.role !== "ELEVE"),
    ]);
    groupMeta = pack[0];
    directoryPeople = pack[1];
  }

  const viewProfileHref = messagingDirectPeerProfileHref(
    user,
    isGroup,
    participants,
  );

  const avg = computeAverageResponseMinutes(messages);

  return (
    <div className="-mx-4 flex h-[calc(100dvh_-_268px)] min-h-[400px] w-auto max-w-none flex-col gap-3 self-stretch sm:h-[calc(100dvh_-_248px)] lg:-mx-10">
      <Link
        href="/messagerie"
        className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToInbox")}
      </Link>

      <ConversationThreadClient
        className="min-h-0 flex-1"
        locale={params.locale}
        conversationId={params.id}
        currentUserId={user.id}
        title={title}
        isGroup={isGroup}
        viewProfileHref={viewProfileHref}
        initialMessages={messages}
        participants={participants}
        averageResponseMinutes={avg}
        groupMeta={isGroup ? groupMeta : undefined}
        directoryPeople={isGroup ? directoryPeople : undefined}
      />
    </div>
  );
}
