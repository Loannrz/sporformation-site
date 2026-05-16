"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import type { SessionUser } from "@/types";
import {
  buildNavItems,
  isNavLinkActive,
  type NavItem,
} from "@/components/layout/nav-config";
import { SporformationLogo } from "@/components/logo/sporformation-logo";
import { DisciplineQuickDialog } from "@/components/discipline/discipline-quick-dialog";
import type { DisciplineDialogOptions } from "@/lib/data/school";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const EMPTY_SEARCH = new URLSearchParams();

type NavLinkShellProps = {
  iconOnly: boolean;
  items: NavItem[];
  user: SessionUser;
  pathname: string;
  searchParams: URLSearchParams;
  disciplineOptions: DisciplineDialogOptions | null;
  notificationCount: number;
  sanctionsReminderCount: number;
  leadFormsPendingCount: number;
  linkCls: (active: boolean, iconOnly: boolean) => string;
  onNavigate: () => void;
};

function SidebarNavLinks({
  iconOnly,
  items,
  user,
  pathname,
  searchParams,
  disciplineOptions,
  notificationCount,
  sanctionsReminderCount,
  leadFormsPendingCount,
  linkCls,
  onNavigate,
}: NavLinkShellProps) {
  const t = useTranslations("nav");

  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        if (item.kind === "discipline-dialog") {
          if (!disciplineOptions) return null;
          return (
            <DisciplineQuickDialog
              key="discipline-dialog"
              options={disciplineOptions}
              iconOnly={iconOnly}
              linkCls={linkCls}
              onMobileNavDismiss={onNavigate}
            />
          );
        }

        const href = item.href;
        const active = isNavLinkActive(pathname, searchParams, item, user);
        const linkKey = `${item.labelKey}-${href}`;
        const Icon = item.icon;
        const label = t(item.labelKey);
        const showMsgBadge =
          item.labelKey === "messaging" && notificationCount > 0;
        const showSanctionsNavBadge =
          item.labelKey === "adminSanctions" && sanctionsReminderCount > 0;
        const showLeadFormsNavBadge =
          item.labelKey === "admin" && leadFormsPendingCount > 0;
        let badgeValue = 0;
        if (showMsgBadge) badgeValue = notificationCount;
        else if (showSanctionsNavBadge) badgeValue = sanctionsReminderCount;
        else if (showLeadFormsNavBadge) badgeValue = leadFormsPendingCount;

        const showAnyBadge =
          showMsgBadge || showSanctionsNavBadge || showLeadFormsNavBadge;
        const badge = showAnyBadge ? (
          <span
            className={cn(
              "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground",
              !iconOnly && "ml-auto",
            )}
            aria-label={
              showLeadFormsNavBadge
                ? t("leadFormsPendingNavAria", { count: badgeValue })
                : undefined
            }
          >
            {badgeValue > 9 ? "9+" : badgeValue}
          </span>
        ) : null;

        const linkBody = (
          <Link
            href={href}
            onClick={onNavigate}
            className={linkCls(active, iconOnly)}
          >
            <span className="relative shrink-0">
              <Icon className="h-4 w-4 opacity-80" />
              {iconOnly && badge ? (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold leading-none text-primary-foreground">
                  {badgeValue > 9 ? "+" : badgeValue}
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
            <Tooltip key={linkKey} delayDuration={300}>
              <TooltipTrigger asChild>{linkBody}</TooltipTrigger>
              <TooltipContent side="right">
                <div className="flex flex-col gap-1">
                  <span>{label}</span>
                  {showLeadFormsNavBadge ? (
                    <span className="text-xs text-muted-foreground">
                      {t("leadFormsPendingNavAria", { count: badgeValue })}
                    </span>
                  ) : null}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        }

        return <div key={linkKey}>{linkBody}</div>;
      })}
    </nav>
  );
}

function SidebarNavLinksWithSearch(props: Omit<NavLinkShellProps, "searchParams">) {
  const searchParams = useSearchParams();
  return <SidebarNavLinks {...props} searchParams={searchParams} />;
}

type Props = {
  user: SessionUser;
  /** Ex. messages non lus — brancher sur une source temps réel plus tard. */
  notificationCount?: number;
  /** Sanctions actives non consultées dans le hub (personnel habilité). */
  sanctionsReminderCount?: number;
  /** Demandes formulaire vitrine encore « à traiter » (directeur). */
  leadFormsPendingCount?: number;
  /** Données pour la modale « Avertissement » (null si non chargé). */
  disciplineOptions: DisciplineDialogOptions | null;
};

export function AppSidebar({
  user,
  notificationCount = 0,
  sanctionsReminderCount = 0,
  leadFormsPendingCount = 0,
  disciplineOptions,
}: Props) {
  const pathname = usePathname();
  const items = buildNavItems(user);
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Grand écran : barre étroite par défaut, s’élargit au survol pour afficher les libellés. */
  const [lgRailHovered, setLgRailHovered] = useState(false);

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

  const navShellProps = (iconOnly: boolean) =>
    ({
      iconOnly,
      items,
      user,
      pathname,
      disciplineOptions,
      notificationCount,
      sanctionsReminderCount,
      leadFormsPendingCount,
      linkCls,
      onNavigate: () => setDrawerOpen(false),
    }) satisfies Omit<NavLinkShellProps, "searchParams">;

  const NavInner = ({ iconOnly }: { iconOnly: boolean }) => (
    <Suspense
      fallback={
        <SidebarNavLinks
          {...navShellProps(iconOnly)}
          searchParams={EMPTY_SEARCH}
        />
      }
    >
      <SidebarNavLinksWithSearch {...navShellProps(iconOnly)} />
    </Suspense>
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
          <SporformationLogo compact className="h-8 max-w-full" />
        </Link>
      </div>

      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-card/40 backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto",
          "transition-[width] duration-200 ease-out",
          lgRailHovered ? "lg:w-64" : "lg:w-[4.25rem]",
        )}
        onMouseEnter={() => setLgRailHovered(true)}
        onMouseLeave={() => setLgRailHovered(false)}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
          <Link
            href="/dashboard"
            className="flex min-h-0 min-w-0 flex-1 items-center overflow-hidden"
          >
            <SporformationLogo className="h-8 shrink-0" />
          </Link>
        </div>

        <NavInner iconOnly={!lgRailHovered} />

        <div className="mt-auto border-t border-border p-2">
          <Footer iconOnly={!lgRailHovered} />
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
