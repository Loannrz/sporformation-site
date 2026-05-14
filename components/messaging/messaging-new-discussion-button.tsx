"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { MessageSquarePlus, Search, Users, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/routing";
import type { MessagingDirectoryPerson } from "@/lib/data/messaging";
import {
  createDirectConversationAction,
  createGroupConversationAction,
} from "@/app/actions/messaging";
import { toast } from "sonner";

function errorMessage(
  code: string,
  t: (key: string) => string,
): string {
  const map: Record<string, string> = {
    FORBIDDEN: "errors.FORBIDDEN",
    NO_DB: "errors.NO_DB",
    INVALID_PARTICIPANT: "errors.INVALID_PARTICIPANT",
    CREATE_CONV_FAILED: "errors.CREATE_CONV_FAILED",
    GROUP_MIN_TWO_OTHERS: "errors.GROUP_MIN_TWO_OTHERS",
    GROUP_NAME_REQUIRED: "errors.GROUP_NAME_REQUIRED",
    NOT_PARTICIPANT: "errors.NOT_PARTICIPANT",
    EMPTY_MESSAGE: "errors.EMPTY_MESSAGE",
    INVALID_CONVERSATION: "errors.INVALID_CONVERSATION",
    PROFILE_REQUIRED: "errors.PROFILE_REQUIRED",
  };
  const key = map[code];
  return key ? t(key) : code;
}

type Props = {
  locale: AppLocale;
  directory: MessagingDirectoryPerson[];
};

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export function MessagingNewDiscussionButton({ locale, directory }: Props) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"one" | "group">("one");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return directory;
    return directory.filter((p) => {
      const n = `${p.firstName} ${p.lastName}`.toLowerCase();
      const sub = (p.subtitle ?? "").toLowerCase();
      return n.includes(s) || sub.includes(s);
    });
  }, [directory, q]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else {
        if (mode === "one") {
          n.clear();
          n.add(id);
        } else n.add(id);
      }
      return n;
    });
  };

  const startDirect = () => {
    const other = [...selectedIds][0];
    if (!other) {
      toast.error(t("newDialogPickPerson"));
      return;
    }
    startTransition(async () => {
      const res = await createDirectConversationAction(locale, other);
      if (!res.ok) {
        toast.error(errorMessage(res.error, t));
        return;
      }
      setOpen(false);
      setSelectedIds(new Set());
      setQ("");
      router.push(`/messagerie/${res.conversationId}`);
      router.refresh();
    });
  };

  const startGroup = () => {
    if (selectedIds.size < 2) {
      toast.error(t("newDialogPickTwoForGroup"));
      return;
    }
    if (!groupName.trim()) {
      toast.error(t("newDialogGroupNameRequired"));
      return;
    }
    startTransition(async () => {
      const res = await createGroupConversationAction(locale, {
        name: groupName.trim(),
        memberProfileIds: [...selectedIds],
      });
      if (!res.ok) {
        toast.error(errorMessage(res.error, t));
        return;
      }
      setOpen(false);
      setSelectedIds(new Set());
      setGroupName("");
      setQ("");
      router.push(`/messagerie/${res.conversationId}`);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="default"
          className="gap-2 shadow-sm"
          aria-label={t("newDiscussionAria")}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {t("newDiscussion")}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,640px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-xl font-semibold">
            {t("newDialogTitle")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t("newDialogHint")}</p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-5 pt-3">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as "one" | "group");
              setSelectedIds(new Set());
            }}
            className="flex min-h-0 flex-1 flex-col gap-3"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="one" className="gap-2">
                <User className="h-4 w-4" />
                {t("newDialogTabOne")}
              </TabsTrigger>
              <TabsTrigger value="group" className="gap-2">
                <Users className="h-4 w-4" />
                {t("newDialogTabGroup")}
              </TabsTrigger>
            </TabsList>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder={t("newDialogSearchPlaceholder")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t("newDialogSearchPlaceholder")}
              />
            </div>

            <TabsContent
              value="one"
              className="mt-0 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden"
            >
              <ScrollArea className="h-[min(45vh,320px)] rounded-lg border bg-muted/20">
                <ul className="divide-y p-1">
                  {filtered.map((p) => {
                    const checked = selectedIds.has(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                            checked ? "bg-primary/12" : "hover:bg-muted/80",
                          )}
                        >
                          <Avatar className="h-11 w-11 border border-border">
                            {p.avatarUrl ? (
                              <AvatarImage src={p.avatarUrl} alt="" />
                            ) : null}
                            <AvatarFallback className="text-xs font-semibold">
                              {initials(p.firstName, p.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium leading-tight">
                              {p.firstName} {p.lastName}
                            </p>
                            {p.subtitle ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {p.subtitle}
                              </p>
                            ) : null}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {checked ? "✓" : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <li className="p-8 text-center text-sm text-muted-foreground">
                      {t("newDialogEmptySearch")}
                    </li>
                  ) : null}
                </ul>
              </ScrollArea>
              <Button
                type="button"
                className="w-full text-base font-semibold"
                size="lg"
                disabled={pending || selectedIds.size !== 1}
                onClick={startDirect}
              >
                {t("newDialogStartChat")}
              </Button>
            </TabsContent>

            <TabsContent
              value="group"
              className="mt-0 flex min-h-0 flex-1 flex-col gap-3 data-[state=inactive]:hidden"
            >
              <div className="space-y-2">
                <Label htmlFor="group-name" className="text-sm font-medium">
                  {t("newDialogGroupNameLabel")}
                </Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t("newDialogGroupNamePlaceholder")}
                />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("newDialogGroupHint")}
              </p>
              <ScrollArea className="h-[min(38vh,260px)] rounded-lg border bg-muted/20">
                <ul className="space-y-0.5 p-2">
                  {filtered.map((p) => {
                    const checked = selectedIds.has(p.id);
                    return (
                      <li key={p.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors",
                            checked ? "bg-primary/12" : "hover:bg-muted/80",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-border bg-background",
                              checked && "border-primary bg-primary text-primary-foreground",
                            )}
                            aria-hidden
                          >
                            {checked ? (
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            ) : null}
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => toggle(p.id)}
                          />
                          <Avatar className="h-9 w-9 border">
                            {p.avatarUrl ? (
                              <AvatarImage src={p.avatarUrl} alt="" />
                            ) : null}
                            <AvatarFallback className="text-[10px]">
                              {initials(p.firstName, p.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {p.firstName} {p.lastName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {p.subtitle}
                            </span>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
              <Button
                type="button"
                className="w-full text-base font-semibold"
                size="lg"
                disabled={pending || selectedIds.size < 2}
                onClick={startGroup}
              >
                {t("newDialogCreateGroup")}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
