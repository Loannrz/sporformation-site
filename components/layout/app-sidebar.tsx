"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import type { SessionUser } from "@/types";
import { buildNavItems } from "@/components/layout/nav-config";
import { SporformationLogo } from "@/components/logo/sporformation-logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  user: SessionUser;
};

export function AppSidebar({ user }: Props) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = buildNavItems(user);
  const [open, setOpen] = useState(false);

  const linkCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-primary/12 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const NavInner = () => (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={linkCls(active)}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="shrink-0"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <Link href="/dashboard" className="min-w-0">
          <SporformationLogo compact className="w-full" />
        </Link>
      </div>

      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 backdrop-blur lg:flex lg:flex-col lg:min-h-screen">
        <div className="border-b border-border px-4 py-5">
          <Link href="/dashboard">
            <SporformationLogo />
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            {user.firstName} {user.lastName}
          </p>
        </div>
        <NavInner />
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
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
            <NavInner />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
