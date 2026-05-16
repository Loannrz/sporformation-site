import type { SessionUser } from "@/types";
import { canAccessSanctionsHub, hasPermission } from "@/lib/permissions";
import { isStaffAdmin } from "@/lib/roles";
import { canOpenAdministrationHub } from "@/lib/pedago-access";
import {
  LayoutDashboard,
  Megaphone,
  Cloud,
  MessageSquare,
  Users,
  CalendarDays,
  Shield,
  AlertTriangle,
  ClipboardList,
  FileText,
  type LucideIcon,
} from "lucide-react";

export type NavLabelKey =
  | "dashboard"
  | "announcements"
  | "cloud"
  | "messaging"
  | "classes"
  | "calendar"
  | "warnings"
  | "admin"
  | "adminSanctions"
  | "requiredDocuments";

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
      return hasPermission(user, "UPLOAD_FILES");
    case "messaging":
      return hasPermission(user, "SEND_MESSAGES");
    case "calendar":
      return hasPermission(user, "VIEW_CALENDAR");
    default:
      return true;
  }
}

/** État actif sidebar : préfixe `/cloud` incluant l’accueil et les sous-routes dossier. */
export function isNavLinkActive(
  pathname: string,
  _searchParams: URLSearchParams,
  item: NavItem,
  _user: SessionUser,
): boolean {
  if (item.kind !== "link") return false;

  const href = item.href;
  const pathOnly = href.split("?")[0];

  if (item.labelKey === "cloud") {
    if (pathname === "/cloud") {
      return true;
    }
    if (pathname.startsWith("/cloud/")) {
      return true;
    }
    return false;
  }

  if (item.labelKey === "requiredDocuments") {
    if (pathname === "/documents-a-fournir") return true;
    if (pathname.startsWith("/documents-a-fournir/")) return true;
    return false;
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

    if (canAccessSanctionsHub(user)) {
      items.push({
        kind: "link",
        href: "/sanctions",
        labelKey: "adminSanctions",
        icon: ClipboardList,
      });
    }

    return items;
  }

  if (user.teacherDocumentsGateActive === true) {
    return [
      {
        kind: "link",
        href: "/documents-a-fournir",
        labelKey: "requiredDocuments",
        icon: FileText,
      },
    ];
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

  if (canAccessSanctionsHub(user)) {
    filtered.push({
      kind: "link",
      href: "/sanctions",
      labelKey: "adminSanctions",
      icon: ClipboardList,
    });
  }

  if (hasPermission(user, "ADD_SANCTION")) {
    filtered.push({
      kind: "discipline-dialog",
      labelKey: "warnings",
      icon: AlertTriangle,
      permission: "ADD_SANCTION",
    });
  }

  if (canOpenAdministrationHub(user)) {
    filtered.push({
      kind: "link",
      href: "/admin",
      labelKey: "admin",
      icon: Shield,
    });
  }

  return filtered;
}
