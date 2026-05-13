"use client";

import { Command } from "cmdk";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { SessionUser } from "@/types";
import { buildNavItems } from "@/components/layout/nav-config";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  GraduationCap,
  Megaphone,
  School,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

type Props = {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ user, open, onOpenChange }: Props) {
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" || e.key === "K") {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onOpenChange(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  const items = buildNavItems(user);

  const adminDeepItems: {
    href: string;
    labelKey:
      | "adminAccounts"
      | "adminAnnouncements"
      | "adminCalendar"
      | "adminClasses"
      | "adminStudents";
    Icon: LucideIcon;
  }[] = [];

  if (isStaffAdmin(user)) {
    adminDeepItems.push({
      href: "/admin/users",
      labelKey: "adminAccounts",
      Icon: Users,
    });
    if (hasPermission(user, "CREATE_ANNOUNCEMENTS")) {
      adminDeepItems.push({
        href: "/admin/announcements",
        labelKey: "adminAnnouncements",
        Icon: Megaphone,
      });
    }
    adminDeepItems.push({
      href: "/admin/calendar",
      labelKey: "adminCalendar",
      Icon: CalendarDays,
    });
    adminDeepItems.push({
      href: "/admin/students",
      labelKey: "adminStudents",
      Icon: GraduationCap,
    });
  }

  if (isDirector(user)) {
    adminDeepItems.push({
      href: "/administration/classes",
      labelKey: "adminClasses",
      Icon: School,
    });
  }

  const accountItems = [
    {
      href: "/parametres",
      labelKey: "settings" as const,
      Icon: Settings,
    },
    {
      href: `/profil/${user.id}`,
      labelKey: "profile" as const,
      Icon: UserRound,
    },
  ];

  const go = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  const groupHeading =
    "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

  const itemCls =
    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground";

  return (
    <Command.Dialog
      label={tCommon("commandMenuLabel")}
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="fixed left-1/2 top-[14vh] z-[100] max-h-[min(420px,70vh)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur-xl"
      overlayClassName="fixed inset-0 z-[99] bg-background/60 backdrop-blur-sm"
    >
      <Command.Input
        placeholder={tCommon("commandMenuPlaceholder")}
        className="flex h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground"
      />
      <Command.List className="max-h-[340px] overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          {tCommon("commandMenuEmpty")}
        </Command.Empty>

        <Command.Group
          heading={tCommon("commandMenuGroupMain")}
          className={groupHeading}
        >
          {items
            .filter((item): item is Extract<typeof item, { kind: "link" }> => item.kind === "link")
            .map((item) => {
            const Icon = item.icon;
            return (
              <Command.Item
                key={item.href}
                value={`${tNav(item.labelKey)} ${item.href}`}
                onSelect={() => go(item.href)}
                className={itemCls}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span>{tNav(item.labelKey)}</span>
              </Command.Item>
            );
          })}
        </Command.Group>

        {adminDeepItems.length > 0 ? (
          <Command.Group
            heading={tCommon("commandMenuGroupAdmin")}
            className={groupHeading}
          >
            {adminDeepItems.map(({ href, labelKey, Icon }) => (
              <Command.Item
                key={href}
                value={`${tNav(labelKey)} ${href}`}
                onSelect={() => go(href)}
                className={itemCls}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                <span>{tNav(labelKey)}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group
          heading={tCommon("commandMenuGroupAccount")}
          className={groupHeading}
        >
          {accountItems.map(({ href, labelKey, Icon }) => (
            <Command.Item
              key={href}
              value={`${tNav(labelKey)} ${href}`}
              onSelect={() => go(href)}
              className={itemCls}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              <span>{tNav(labelKey)}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
