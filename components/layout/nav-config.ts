import type { SessionUser } from "@/types";
import { hasPermission } from "@/lib/permissions";
import { isStaffAdmin } from "@/lib/roles";
import {
  LayoutDashboard,
  Megaphone,
  Cloud,
  Files,
  MessageSquare,
  Users,
  CalendarDays,
  Shield,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

export type NavLabelKey =
  | "dashboard"
  | "announcements"
  | "cloud"
  | "files"
  | "messaging"
  | "classes"
  | "calendar"
  | "warnings"
  | "admin";

export type NavItem =
  | {
      kind: "link";
      href: string;
      labelKey: NavLabelKey;
      icon: LucideIcon;
    }
  | {
      kind: "discipline-dialog";
      labelKey: "warnings";
      icon: typeof AlertTriangle;
      permission: "ADD_SANCTION";
    };

function staffShowsLink(user: SessionUser, item: NavItem): boolean {
  if (item.kind === "discipline-dialog") return true;
  if (item.kind !== "link") return false;
  switch (item.labelKey) {
    case "cloud":
    case "files":
      return hasPermission(user, "UPLOAD_FILES");
    case "messaging":
      return hasPermission(user, "SEND_MESSAGES");
    case "calendar":
      return hasPermission(user, "VIEW_CALENDAR");
    default:
      return true;
  }
}

/** État actif de la sidebar : Cloud vs « tous les fichiers » partagent une partie du préfixe `/cloud`. */
export function isNavLinkActive(
  pathname: string,
  searchParams: URLSearchParams,
  item: NavItem,
  _user: SessionUser,
): boolean {
  if (item.kind !== "link") return false;

  const href = item.href;
  const pathOnly = href.split("?")[0];

  if (item.labelKey === "cloud") {
    if (pathname === "/cloud") {
      return searchParams.get("tab") !== "all";
    }
    if (pathname.startsWith("/cloud/")) {
      return true;
    }
    return false;
  }

  if (item.labelKey === "files") {
    return pathname === "/cloud" && searchParams.get("tab") === "all";
  }

  if (pathname === pathOnly) return true;
  if (pathOnly !== "/" && pathname.startsWith(`${pathOnly}/`)) return true;
  return false;
}

export function buildNavItems(user: SessionUser | null): NavItem[] {
  if (!user) return [];

  if (user.role === "ELEVE") {
    const items: NavItem[] = [
      {
        kind: "link",
        href: "/dashboard",
        labelKey: "dashboard",
        icon: LayoutDashboard,
      },
      {
        kind: "link",
        href: "/annonces",
        labelKey: "announcements",
        icon: Megaphone,
      },
    ];

    if (hasPermission(user, "ACCESS_STUDENT_CLOUD")) {
      items.push({
        kind: "link",
        href: "/cloud",
        labelKey: "cloud",
        icon: Cloud,
      });
    }

    if (hasPermission(user, "SEND_MESSAGES")) {
      items.push({
        kind: "link",
        href: "/messagerie",
        labelKey: "messaging",
        icon: MessageSquare,
      });
    }

    return items;
  }

  const core: NavItem[] = [
    {
      kind: "link",
      href: "/dashboard",
      labelKey: "dashboard",
      icon: LayoutDashboard,
    },
    {
      kind: "link",
      href: "/annonces",
      labelKey: "announcements",
      icon: Megaphone,
    },
    {
      kind: "link",
      href: "/cloud",
      labelKey: "cloud",
      icon: Cloud,
    },
    {
      kind: "link",
      href: "/cloud?tab=all",
      labelKey: "files",
      icon: Files,
    },
    {
      kind: "link",
      href: "/messagerie",
      labelKey: "messaging",
      icon: MessageSquare,
    },
    {
      kind: "link",
      href: "/classes",
      labelKey: "classes",
      icon: Users,
    },
    {
      kind: "link",
      href: "/calendrier",
      labelKey: "calendar",
      icon: CalendarDays,
    },
  ];

  const filtered = core.filter((item) => staffShowsLink(user, item));

  if (hasPermission(user, "ADD_SANCTION")) {
    filtered.push({
      kind: "discipline-dialog",
      labelKey: "warnings",
      icon: AlertTriangle,
      permission: "ADD_SANCTION",
    });
  }

  if (isStaffAdmin(user)) {
    filtered.push({
      kind: "link",
      href: "/admin",
      labelKey: "admin",
      icon: Shield,
    });
  }

  return filtered;
}
