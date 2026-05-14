"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Paperclip, SendHorizonal, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type {
  MessagingConversationGroupMeta,
  MessagingDirectoryPerson,
  MessagingMessageRow,
  MessagingParticipant,
} from "@/lib/data/messaging";
import type { AppLocale } from "@/i18n/routing";
import {
  markConversationReadAction,
  sendMessageAction,
} from "@/app/actions/messaging";
import { GroupParticipantsDialog } from "@/components/messaging/group-participants-dialog";
import { toast } from "sonner";

type Props = {
  locale: AppLocale;
  conversationId: string;
  currentUserId: string;
  title: string;
  isGroup: boolean;
  /** Discussion 1-à-1 : lien fiche (`/profil/…` ou `/etudiants/…`) si autorisé. */
  viewProfileHref: string | null;
  initialMessages: MessagingMessageRow[];
  participants: MessagingParticipant[];
  averageResponseMinutes: number | null;
  /** Discussion de groupe uniquement — métadonnées pour la gestion du groupe */
  groupMeta?: MessagingConversationGroupMeta | null;
  /** Réutilisation de la même liste que pour « Nouvelle discussion » ; uniquement lorsque groupe */
  directoryPeople?: MessagingDirectoryPerson[];
  /** Conteneur : utiliser avec le parent `flex flex-col` + hauteur viewport pour tout remplir. */
  className?: string;
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatAttachmentSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

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
    FILE_TOO_LARGE: "errors.FILE_TOO_LARGE",
    ATTACH_UPLOAD_FAILED: "errors.ATTACH_UPLOAD_FAILED",
    NO_SERVICE_ROLE: "errors.NO_SERVICE_ROLE",
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
  viewProfileHref,
  initialMessages,
  participants,
  averageResponseMinutes,
  groupMeta = null,
  directoryPeople,
  className,
}: Props) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const dfLocale = locale === "fr" ? fr : enUS;
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const markedRef = useRef(false);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of participants) {
      m.set(p.profileId, p.displayName);
    }
    return m;
  }, [participants]);

  const avatarByUserId = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of participants) {
      m.set(p.profileId, p.avatarUrl);
    }
    return m;
  }, [participants]);

  const selfDisplayName = useMemo(
    () =>
      participants.find((p) => p.profileId === currentUserId)?.displayName ??
      null,
    [participants, currentUserId],
  );

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
    if (msg.kind !== "user") return [];
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
    const canSendBody = Boolean(body);
    const canSendFile = Boolean(attachment?.size);
    if ((!canSendBody && !canSendFile) || pending) return;
    if (attachment && attachment.size > MAX_ATTACHMENT_BYTES) {
      toast.error(t("errors.FILE_TOO_LARGE"));
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("body", draft);
      if (attachment) fd.set("file", attachment);
      const res = await sendMessageAction(locale, fd);
      if (!res.ok) {
        toast.error(errorMessage(res.error, t));
        return;
      }
      setDraft("");
      setAttachment(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  const avgLabel =
    averageResponseMinutes != null
      ? t("avgResponseLine", { minutes: averageResponseMinutes })
      : null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="shrink-0 rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {title}
            </h1>
            {avgLabel ? (
              <p className="mt-1 text-sm text-muted-foreground">{avgLabel}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-start justify-start gap-2 sm:justify-end">
            {isGroup && groupMeta ? (
              <GroupParticipantsDialog
                locale={locale}
                conversationId={conversationId}
                currentUserId={currentUserId}
                participants={participants}
                directory={directoryPeople ?? []}
                groupMeta={groupMeta}
              />
            ) : null}
            {viewProfileHref ? (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                asChild
              >
                <Link href={viewProfileHref} aria-label={t("viewProfileAria")}>
                  {t("viewProfile")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card shadow-inner"
        role="log"
        aria-label={t("threadAria")}
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <p className="rounded-xl bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
              {t("threadEmpty")}
            </p>
          ) : null}
          {messages.map((m) => {
            if (m.kind === "system") {
              const actor =
                nameById.get(m.senderId) ?? t("participantUnknown");
              const payload = m.systemPayload;
              let text = "";
              if (payload?.type === "group_member_added") {
                text = t("systemGroupMemberAdded", {
                  actor,
                  target:
                    nameById.get(payload.targetUserId) ??
                    t("participantUnknown"),
                });
              } else if (payload?.type === "group_member_removed") {
                text = t("systemGroupMemberRemoved", {
                  actor,
                  target:
                    nameById.get(payload.targetUserId) ??
                    t("participantUnknown"),
                });
              } else if (payload?.type === "group_admin_transferred") {
                text = t("systemGroupAdminTransferred", {
                  actor,
                  target:
                    nameById.get(payload.newAdminUserId) ??
                    t("participantUnknown"),
                });
              }
              return (
                <div
                  key={m.id}
                  className="flex flex-col items-center gap-1 px-2 py-2"
                >
                  <div className="max-w-xl rounded-full border border-border/80 bg-muted/55 px-4 py-2 text-center text-xs leading-relaxed text-muted-foreground shadow-sm sm:text-sm">
                    {text || t("systemGroupFallback")}
                  </div>
                  <time
                    dateTime={m.sentAt}
                    className="text-[10px] text-muted-foreground"
                  >
                    {format(new Date(m.sentAt), "PPp", { locale: dfLocale })}
                  </time>
                </div>
              );
            }

            const mine = m.senderId === currentUserId;
            const senderName = mine
              ? t("you")
              : (nameById.get(m.senderId) ?? t("participantUnknown"));
            const readers = readersForMessage(m);
            const bubbleAvatar = avatarByUserId.get(m.senderId)?.trim();

            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-1", mine && "items-end")}
              >
                <div
                  className={cn(
                    "flex w-full max-w-[min(100%,52rem)] gap-2",
                    mine ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  <Avatar className="mt-5 h-9 w-9 shrink-0 shadow-sm ring-2 ring-background">
                    {bubbleAvatar ? (
                      <AvatarImage src={bubbleAvatar} alt="" />
                    ) : null}
                    <AvatarFallback className="text-[10px] font-semibold">
                      {mine
                        ? initialsFromName(
                            selfDisplayName ?? t("you"),
                          )
                        : initialsFromName(senderName)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "flex min-w-0 flex-1 flex-col gap-0.5",
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
                    {m.attachment ? (
                      <a
                        href={`/api/messaging/attachments/${m.id}`}
                        className={cn(
                          "mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm transition hover:opacity-90",
                          mine
                            ? "border-primary-foreground/40 bg-primary/30 text-primary-foreground"
                            : "border-border bg-background/80 text-foreground hover:bg-background",
                        )}
                        aria-label={t("attachmentDownloadAria", {
                          filename: m.attachment.filename,
                        })}
                      >
                        <Paperclip className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="min-w-0 flex-1 truncate">
                          {m.attachment.filename}
                        </span>
                        {formatAttachmentSize(m.attachment.sizeBytes) ? (
                          <span className="shrink-0 text-xs font-normal opacity-80">
                            {formatAttachmentSize(m.attachment.sizeBytes)}
                          </span>
                        ) : null}
                      </a>
                    ) : null}
                    {m.body.trim() ? (
                      <p className="whitespace-pre-wrap break-words">
                        {m.body}
                      </p>
                    ) : null}
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
                </div>
                {mine ? (
                  <div
                    className="flex w-full max-w-[min(100%,52rem)] flex-row justify-end gap-1 pr-1"
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

        <div className="shrink-0 border-t border-border bg-muted/20 p-4 sm:p-5">
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) {
                setAttachment(null);
                return;
              }
              if (f.size > MAX_ATTACHMENT_BYTES) {
                toast.error(t("errors.FILE_TOO_LARGE"));
                e.target.value = "";
                setAttachment(null);
                return;
              }
              setAttachment(f);
            }}
          />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-2"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
              aria-label={String(t("addAttachmentAria"))}
            >
              <Paperclip className="h-4 w-4" />
              {t("attachmentHint")}
            </Button>
          </div>
          {attachment ? (
            <div className="mb-3 flex max-w-xl items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">
                <span className="text-muted-foreground">
                  {t("selectedFileLabel")}:{" "}
                </span>
                {attachment.name}
                <span className="text-muted-foreground">
                  {" "}
                  ({formatAttachmentSize(attachment.size)})
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={String(t("removeAttachmentAria"))}
                disabled={pending}
                onClick={() => {
                  setAttachment(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
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
              disabled={
                pending || (!draft.trim() && !(attachment?.size ?? 0))
              }
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
