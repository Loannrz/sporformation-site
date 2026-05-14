"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type {
  MessagingMessageRow,
  MessagingParticipant,
} from "@/lib/data/messaging";
import type { AppLocale } from "@/i18n/routing";
import {
  markConversationReadAction,
  sendMessageAction,
} from "@/app/actions/messaging";
import { toast } from "sonner";

type Props = {
  locale: AppLocale;
  conversationId: string;
  currentUserId: string;
  title: string;
  isGroup: boolean;
  initialMessages: MessagingMessageRow[];
  participants: MessagingParticipant[];
  averageResponseMinutes: number | null;
};

function initialsFromName(name: string) {
  const p = name.trim().split(/\s+/);
  return (
    ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase() || "?"
  );
}

function errorMessage(code: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    FORBIDDEN: "errors.FORBIDDEN",
    NO_DB: "errors.NO_DB",
    NOT_PARTICIPANT: "errors.NOT_PARTICIPANT",
    EMPTY_MESSAGE: "errors.EMPTY_MESSAGE",
    INVALID_CONVERSATION: "errors.INVALID_CONVERSATION",
    PROFILE_REQUIRED: "errors.PROFILE_REQUIRED",
  };
  const k = map[code];
  return k ? t(k) : code;
}

export function ConversationThreadClient({
  locale,
  conversationId,
  currentUserId,
  title,
  isGroup,
  initialMessages,
  participants,
  averageResponseMinutes,
}: Props) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const dfLocale = locale === "fr" ? fr : enUS;
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of participants) {
      m.set(p.profileId, p.displayName);
    }
    return m;
  }, [participants]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    void markConversationReadAction(locale, conversationId);
  }, [locale, conversationId]);

  const readersForMessage = (msg: MessagingMessageRow) => {
    if (msg.senderId !== currentUserId) return [];
    const sent = new Date(msg.sentAt).getTime();
    return participants.filter((p) => {
      if (p.profileId === currentUserId) return false;
      if (!p.lastReadAt) return false;
      return new Date(p.lastReadAt).getTime() >= sent;
    });
  };

  const submit = () => {
    const body = draft.trim();
    if (!body || pending) return;
    startTransition(async () => {
      const res = await sendMessageAction(locale, {
        conversationId,
        body,
      });
      if (!res.ok) {
        toast.error(errorMessage(res.error, t));
        return;
      }
      setDraft("");
      router.refresh();
    });
  };

  const avgLabel =
    averageResponseMinutes != null
      ? t("avgResponseLine", { minutes: averageResponseMinutes })
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-sm sm:px-5">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {avgLabel ? (
          <p className="mt-1 text-sm text-muted-foreground">{avgLabel}</p>
        ) : null}
      </div>

      <div
        className="flex max-h-[min(70vh,560px)] min-h-[280px] flex-col rounded-2xl border border-border bg-card shadow-inner"
        role="log"
        aria-label={t("threadAria")}
      >
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
              {t("threadEmpty")}
            </p>
          ) : null}
          {messages.map((m) => {
            const mine = m.senderId === currentUserId;
            const senderName = mine
              ? t("you")
              : (nameById.get(m.senderId) ?? t("participantUnknown"));
            const readers = readersForMessage(m);

            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1", mine && "items-end")}
              >
                <div
                  className={cn(
                    "flex max-w-[min(100%,28rem)] flex-col gap-0.5",
                    mine && "items-end",
                  )}
                >
                  {isGroup && !mine ? (
                    <span className="px-2 text-xs font-semibold text-primary">
                      {senderName}
                    </span>
                  ) : null}
                  {mine ? (
                    <span className="px-2 text-xs font-medium text-muted-foreground">
                      {t("you")}
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-base leading-relaxed shadow-sm sm:text-[1.05rem]",
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-muted text-foreground",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 text-[11px] text-muted-foreground",
                      mine && "flex-row-reverse",
                    )}
                  >
                    <time dateTime={m.sentAt}>
                      {format(new Date(m.sentAt), "PPp", { locale: dfLocale })}
                    </time>
                  </div>
                </div>
                {mine ? (
                  <div
                    className="flex max-w-[min(100%,28rem)] flex-row justify-end gap-1 pr-1"
                    aria-label={t("readByAria")}
                  >
                    {readers.length > 0 ? (
                      readers.slice(0, 5).map((r) => (
                        <Avatar
                          key={r.profileId}
                          className="h-7 w-7 border-2 border-background shadow-sm"
                          title={`${t("readBy")}: ${r.displayName}`}
                        >
                          {r.avatarUrl ? (
                            <AvatarImage src={r.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-[9px] font-semibold">
                            {initialsFromName(r.displayName)}
                          </AvatarFallback>
                        </Avatar>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {t("notReadYet")}
                      </span>
                    )}
                    {readers.length > 5 ? (
                      <span className="self-center text-[10px] text-muted-foreground">
                        +{readers.length - 5}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border bg-muted/20 p-4 sm:p-5">
          <label className="sr-only" htmlFor="msg-draft">
            {t("composeLabel")}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Textarea
              id="msg-draft"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("composePlaceholder")}
              className="min-h-[5.5rem] flex-1 resize-none rounded-xl border-2 text-base"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button
              type="button"
              size="lg"
              className="h-12 shrink-0 gap-2 rounded-xl px-6 text-base font-semibold shadow-md"
              disabled={pending || !draft.trim()}
              onClick={submit}
            >
              <SendHorizonal className="h-5 w-5" />
              {t("send")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
