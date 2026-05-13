"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  PanelLeftClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import type { SessionUser } from "@/types";
import { buildNavItems } from "@/components/layout/nav-config";
import { SporformationLogo } from "@/components/logo/sporformation-logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COLLAPSED_KEY = "sporformation-sidebar-collapsed";

type Props = {
  user: SessionUser;
  /** Ex. messages non lus — brancher sur une source temps réel plus tard. */
  notificationCount?: number;
};

export function AppSidebar({ user, notificationCount = 0 }: Props) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const items = buildNavItems(user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === "1") {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  const linkCls = (active: boolean, iconOnly: boolean) =>
    cn(
      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      iconOnly && "justify-center px-2",
      active
        ? "bg-primary/12 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const Footer = ({ iconOnly }: { iconOnly: boolean }) => {
    const initials =
      `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || "SF";
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    const block = (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-2 py-2",
          iconOnly && "justify-center",
        )}
      >
        <Avatar className="h-9 w-9 border border-border">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt="" />
          ) : null}
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!iconOnly ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        ) : null}
      </div>
    );

    if (iconOnly) {
      return (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>{block}</TooltipTrigger>
          <TooltipContent side="right">
            <p className="max-w-[220px] break-all font-medium">{fullName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return block;
  };

  const NavInner = ({ iconOnly }: { iconOnly: boolean }) => (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const label = t(item.labelKey);
        const badge =
          item.href === "/messagerie" && notificationCount > 0 ? (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground",
                !iconOnly && "ml-auto",
              )}
            >
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          ) : null;

        const linkBody = (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={linkCls(active, iconOnly)}
          >
            <span className="relative shrink-0">
              <Icon className="h-4 w-4 opacity-80" />
              {iconOnly && badge ? (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold leading-none text-primary-foreground">
                  {notificationCount > 9 ? "+" : notificationCount}
                </span>
              ) : null}
            </span>
            {!iconOnly ? (
              <>
                <span className="min-w-0 truncate">{label}</span>
                {badge}
              </>
            ) : null}
          </Link>
        );

        if (iconOnly) {
          return (
            <Tooltip key={item.href} delayDuration={300}>
              <TooltipTrigger asChild>{linkBody}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        }

        return linkBody;
      })}
    </nav>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="shrink-0"
          onClick={() => setDrawerOpen((o) => !o)}
          aria-label="Menu"
        >
          {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <Link href="/dashboard" className="min-w-0">
          <SporformationLogo compact className="w-full" />
        </Link>
      </div>

      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-card/40 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto",
          collapsed ? "lg:w-[4.25rem]" : "lg:w-64",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border px-3 py-4",
            collapsed ? "flex-col" : "justify-between",
          )}
        >
          {collapsed ? (
            <Link href="/dashboard" className="flex justify-center py-1">
              <SporformationLogo compact />
            </Link>
          ) : (
            <Link href="/dashboard" className="min-w-0 flex-1 pl-1">
              <SporformationLogo />
            </Link>
          )}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden shrink-0 lg:flex"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={
                  collapsed
                    ? tCommon("expandSidebar")
                    : tCommon("collapseSidebar")
                }
              >
                {collapsed ? (
                  <PanelRightOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px]">
              {collapsed
                ? tCommon("expandSidebar")
                : tCommon("collapseSidebar")}
            </TooltipContent>
          </Tooltip>
        </div>

        <NavInner iconOnly={collapsed} />

        <div className="mt-auto border-t border-border p-2">
          <Footer iconOnly={collapsed} />
        </div>
      </aside>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {drawerOpen ? (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed left-0 top-0 z-50 flex h-full w-[260px] flex-col border-r border-border bg-card shadow-soft dark:shadow-soft-dark lg:hidden"
          >
            <div className="border-b border-border px-4 py-4">
              <SporformationLogo compact />
            </div>
            <NavInner iconOnly={false} />
            <div className="mt-auto border-t border-border p-2">
              <Footer iconOnly={false} />
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </TooltipProvider>
  );
}
