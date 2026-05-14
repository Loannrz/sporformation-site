"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Users, Shield, Crown, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  MessagingDirectoryPerson,
  MessagingParticipant,
  MessagingConversationGroupMeta,
} from "@/lib/data/messaging";
import type { AppLocale } from "@/i18n/routing";
import {
  addGroupMemberAction,
  removeGroupMemberAction,
  transferGroupAdminAction,
} from "@/app/actions/messaging-group";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  locale: AppLocale;
  conversationId: string;
  currentUserId: string;
  participants: MessagingParticipant[];
  directory: MessagingDirectoryPerson[];
  groupMeta: MessagingConversationGroupMeta;
};

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  const a = p[0]?.[0] ?? "";
  const b = p[p.length - 1]?.[0] ?? "";
  return `${a}${b}`.toUpperCase() || "?";
}

function groupError(code: string, t: ReturnType<typeof useTranslations>): string {
  switch (code) {
    case "FORBIDDEN":
      return t("errors.FORBIDDEN");
    case "NO_DB":
      return t("errors.NO_DB");
    case "NOT_PARTICIPANT":
      return t("errors.NOT_PARTICIPANT");
    case "NOT_GROUP":
      return t("errors.NOT_GROUP");
    case "NOT_GROUP_ADMIN":
      return t("errors.NOT_GROUP_ADMIN");
    case "INVALID_PAYLOAD":
      return t("errors.INVALID_PAYLOAD");
    case "ALREADY_PARTICIPANT":
      return t("errors.ALREADY_PARTICIPANT");
    case "TARGET_NOT_PARTICIPANT":
      return t("errors.TARGET_NOT_PARTICIPANT");
    case "GROUP_MIN_TWO_PARTICIPANTS":
      return t("errors.GROUP_MIN_TWO_PARTICIPANTS");
    case "NEW_ADMIN_NOT_PARTICIPANT":
      return t("errors.NEW_ADMIN_NOT_PARTICIPANT");
    case "ALREADY_ADMIN":
      return t("errors.ALREADY_ADMIN");
    case "CANT_REMOVE_GROUP_ADMIN_BEFORE_TRANSFER":
      return t("errors.CANT_REMOVE_GROUP_ADMIN_BEFORE_TRANSFER");
    default:
      return code;
  }
}

export function GroupParticipantsDialog({
  locale,
  conversationId,
  currentUserId,
  participants,
  directory,
  groupMeta,
}: Props) {
  const t = useTranslations("messaging");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const [makeAdminTargetId, setMakeAdminTargetId] = useState<string | null>(null);

  const participantIds = useMemo(() => new Set(participants.map((p) => p.profileId)), [participants]);

  const creatorId = groupMeta.creatorProfileId ?? null;
  const effectiveAdminId =
    groupMeta.designatedAdminProfileId ?? creatorId ?? null;

  const isCurrentUserAdmin = Boolean(
    effectiveAdminId && currentUserId === effectiveAdminId,
  );

  const nameByParticipantId = useMemo(() => {
    const m = new Map(participants.map((p) => [p.profileId, p.displayName]));
    return m;
  }, [participants]);

  const sortedParticipants = useMemo(() => {
    const copy = [...participants];
    copy.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, locale === "fr" ? "fr" : "en", {
        sensitivity: "base",
      }),
    );
    return copy;
  }, [participants, locale]);

  const addablePeople = useMemo(() => {
    return directory.filter(
      (d) =>
        d.participantAuthId &&
        !participantIds.has(d.participantAuthId),
    );
  }, [directory, participantIds]);

  const filteredAddable = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return addablePeople;
    return addablePeople.filter((p) => {
      const n = `${p.firstName} ${p.lastName}`.toLowerCase();
      const sub = (p.subtitle ?? "").toLowerCase();
      return n.includes(s) || sub.includes(s);
    });
  }, [addablePeople, q]);

  const creatorName = creatorId ? (nameByParticipantId.get(creatorId) ?? "—") : "—";
  const adminDisplayName = effectiveAdminId
    ? (nameByParticipantId.get(effectiveAdminId) ?? "—")
    : "—";

  const badgeAdminId =
    effectiveAdminId ?? "";

  const onAdd = (authId: string) => {
    if (pending) return;
    startTransition(async () => {
      const res = await addGroupMemberAction(locale, conversationId, authId);
      if (!res.ok) {
        toast.error(groupError(res.error, t));
        return;
      }
      toast.success(t("groupMemberAddedToast"));
      setQ("");
      router.refresh();
    });
  };

  const onConfirmRemove = () => {
    if (!removeTargetId || pending) return;
    const id = removeTargetId;
    startTransition(async () => {
      const res = await removeGroupMemberAction(locale, conversationId, id);
      if (!res.ok) {
        toast.error(groupError(res.error, t));
        setRemoveTargetId(null);
        return;
      }
      toast.success(t("groupMemberRemovedToast"));
      setRemoveTargetId(null);
      router.refresh();
    });
  };

  const onConfirmTransfer = () => {
    if (!makeAdminTargetId || pending) return;
    const id = makeAdminTargetId;
    startTransition(async () => {
      const res = await transferGroupAdminAction(locale, conversationId, id);
      if (!res.ok) {
        toast.error(groupError(res.error, t));
        setMakeAdminTargetId(null);
        return;
      }
      toast.success(t("groupAdminTransferredToast"));
      setMakeAdminTargetId(null);
      router.refresh();
    });
  };

  const removeCandidateName =
    removeTargetId && nameByParticipantId.get(removeTargetId)
      ? nameByParticipantId.get(removeTargetId)!
      : "";
  const makeAdminCandidateName =
    makeAdminTargetId && nameByParticipantId.get(makeAdminTargetId)
      ? nameByParticipantId.get(makeAdminTargetId)!
      : "";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-2"
            aria-label={t("groupParticipantsButtonAria")}
          >
            <Users className="h-4 w-4" aria-hidden />
            {t("groupParticipantsButton")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100vw-1.5rem)] max-w-xl gap-4 overflow-hidden p-0 sm:w-full">
          <DialogHeader className="space-y-2 border-b border-border px-5 pb-4 pt-5">
            <DialogTitle className="pr-10 text-left">{t("groupParticipantsTitle")}</DialogTitle>
            <DialogDescription className="text-left text-xs sm:text-sm">
              {creatorId ? (
                <span className="block">
                  {t("groupCreatedBy", { name: creatorName })}
                </span>
              ) : null}
              <span className="mt-1 block">
                {t("groupCurrentAdmin", { name: adminDisplayName })}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-[min(440px,calc(100dvh-200px))] flex-col gap-4 overflow-y-auto px-5 pb-5">
            {isCurrentUserAdmin ? (
              <div className="space-y-2 rounded-xl border border-dashed border-border/80 bg-muted/25 p-4">
                <p className="text-sm font-semibold">{t("groupAddMemberHeading")}</p>
                <Input
                  placeholder={String(t("groupAddMemberPlaceholder"))}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-10 rounded-lg"
                />
                <ul className="max-h-[11rem] space-y-1 overflow-y-auto pr-1 text-sm">
                  {filteredAddable.length === 0 ? (
                    <li className="rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground">
                      {t("groupNoOneToAdd")}
                    </li>
                  ) : (
                    filteredAddable.slice(0, 60).map((p) => {
                      const pid = p.participantAuthId!;
                      const label = `${p.firstName} ${p.lastName}`.trim();
                      return (
                        <li key={p.directoryKey}>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => onAdd(pid)}
                            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-muted disabled:opacity-60"
                          >
                            <span className="truncate font-medium">{label}</span>
                            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("groupAdminOnlyNotice")}</p>
            )}

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("groupMemberListHeading", { count: sortedParticipants.length })}
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
                {sortedParticipants.map((p) => {
                  const isCreator = creatorId !== null && p.profileId === creatorId;
                  const isAdminBadge = Boolean(
                    badgeAdminId && p.profileId === badgeAdminId,
                  );
                  const showAdminActions =
                    isCurrentUserAdmin &&
                    p.profileId !== effectiveAdminId &&
                    p.profileId !== currentUserId;

                  return (
                    <li
                      key={p.profileId}
                      className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0 border border-border shadow-sm">
                          {p.avatarUrl ? (
                            <AvatarImage src={p.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-[10px] font-semibold">
                            {initials(p.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate font-medium leading-snug">{p.displayName}</p>
                            {isCreator ? (
                              <Badge variant="outline" className="shrink-0 gap-1 border-primary/35">
                                <Crown className="h-3 w-3 text-amber-600" aria-hidden />
                                {t("groupBadgeCreator")}
                              </Badge>
                            ) : null}
                            {isAdminBadge ? (
                              <Badge variant="secondary" className="shrink-0 gap-1">
                                <Shield className="h-3 w-3" aria-hidden />
                                {t("groupBadgeAdmin")}
                              </Badge>
                            ) : null}
                          </div>
                          {p.subtitle ? (
                            <p className="truncate text-xs text-muted-foreground">{p.subtitle}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className={cn("flex shrink-0 flex-wrap gap-2")}>
                        {showAdminActions ? (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-9 gap-1 px-3"
                              disabled={pending}
                              onClick={() => setMakeAdminTargetId(p.profileId)}
                            >
                              <Shield className="h-3.5 w-3.5" aria-hidden />
                              {t("groupMakeAdmin")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 gap-1 border-destructive/40 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={pending}
                              onClick={() => setRemoveTargetId(p.profileId)}
                            >
                              <UserMinus className="h-3.5 w-3.5" aria-hidden />
                              {t("groupRemove")}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(removeTargetId)} onOpenChange={(o) => !o && setRemoveTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groupRemoveConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("groupRemoveConfirmDescription", { name: removeCandidateName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                onConfirmRemove();
              }}
            >
              {t("groupRemove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(makeAdminTargetId)} onOpenChange={(o) => !o && setMakeAdminTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("groupMakeAdminConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("groupMakeAdminConfirmDescription", {
                name: makeAdminCandidateName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                onConfirmTransfer();
              }}
            >
              {t("groupMakeAdminConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
