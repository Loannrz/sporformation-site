"use client";

import { useMemo } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  breadcrumbLabelKeyForSegment,
  type BreadcrumbLabelKey,
} from "@/lib/breadcrumb-labels";

type Props = {
  children: React.ReactNode;
  className?: string;
};

const NAV_KEYS = new Set<BreadcrumbLabelKey>([
  "dashboard",
  "announcements",
  "cloud",
  "messaging",
  "classes",
  "calendar",
  "admin",
  "settings",
  "profile",
  "adminRoles",
  "adminAccounts",
  "adminClasses",
  "adminLogs",
  "adminFormations",
]);

export function DashboardPageFrame({ children, className }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const tNav = useTranslations("nav");
  const tBc = useTranslations("breadcrumb");
  const tCommon = useTranslations("common");

  const crumbs = useMemo(() => {
    const raw = pathname.split("/").filter(Boolean);
    const acc: { href: string; labelKey: BreadcrumbLabelKey; isLast: boolean }[] =
      [];
    let href = "";
    for (let i = 0; i < raw.length; i++) {
      const seg = raw[i];
      href += `/${seg}`;
      const labelKey = breadcrumbLabelKeyForSegment(seg, raw, i);
      acc.push({
        href,
        labelKey,
        isLast: i === raw.length - 1,
      });
    }
    return acc;
  }, [pathname]);

  const showBack = crumbs.length > 1;

  const resolveLabel = (key: BreadcrumbLabelKey) => {
    if (NAV_KEYS.has(key)) {
      return tNav(key as Parameters<typeof tNav>[0]);
    }
    return tBc(key);
  };

  return (
    <div className={cn("w-full", className)}>
      {(showBack || crumbs.length > 0) && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {showBack ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 rounded-full"
                aria-label={tCommon("back")}
                onClick={() => router.back()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}
            {crumbs.length > 0 ? (
              <Breadcrumb className="min-w-0">
                <BreadcrumbList className="flex-wrap">
                  {crumbs.map((c, idx) => (
                    <span
                      key={`${c.href}-${idx}`}
                      className="inline-flex items-center gap-1"
                    >
                      {idx > 0 ? (
                        <BreadcrumbSeparator className="hidden sm:inline" />
                      ) : null}
                      <BreadcrumbItem className="max-w-[180px] sm:max-w-[260px]">
                        {c.isLast ? (
                          <BreadcrumbPage className="truncate font-medium">
                            {resolveLabel(c.labelKey)}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link
                              href={c.href}
                              className="truncate hover:text-foreground"
                            >
                              {resolveLabel(c.labelKey)}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
