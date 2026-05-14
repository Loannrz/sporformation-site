import type { SessionUser } from "@/types";
import { hasPermission } from "@/lib/permissions";
import { isStaffAdmin } from "@/lib/roles";
import {
  LayoutDashboard,
  Megaphone,
  Cloud,
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
      permission?: Parameters<typeof hasPermission>[1];
      alternatePermission?: Parameters<typeof hasPermission>[1];
      staffAdminOnly?: boolean;
    }
  | {
      kind: "discipline-dialog";
      labelKey: "warnings";
      icon: typeof AlertTriangle;
      permission: "ADD_SANCTION";
    };

export function buildNavItems(user: SessionUser | null): NavItem[] {
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
    {
      kind: "link",
      href: "/cloud",
      labelKey: "cloud",
      icon: Cloud,
      permission: "UPLOAD_FILES",
      alternatePermission: "ACCESS_STUDENT_CLOUD",
    },
    {
      kind: "link",
      href: "/messagerie",
      labelKey: "messaging",
      icon: MessageSquare,
      permission: "SEND_MESSAGES",
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
      permission: "VIEW_CALENDAR",
    },
  ];

  if (user && hasPermission(user, "ADD_SANCTION")) {
    items.push({
      kind: "discipline-dialog",
      labelKey: "warnings",
      icon: AlertTriangle,
      permission: "ADD_SANCTION",
    });
  }

  if (user && isStaffAdmin(user)) {
    items.push({
      kind: "link",
      href: "/admin",
      labelKey: "admin",
      icon: Shield,
      staffAdminOnly: true,
    });
  }

  return items.filter((item) => {
    if (!user) return false;
    if (item.kind === "link" && item.staffAdminOnly) return isStaffAdmin(user);
    if (item.kind === "link" && item.permission) {
      const mainOk = hasPermission(user, item.permission);
      const altOk =
        item.alternatePermission !== undefined &&
        hasPermission(user, item.alternatePermission);
      if (!mainOk && !altOk) return false;
      return true;
    }
    if (item.permission) return hasPermission(user, item.permission);
    return true;
  });
}
