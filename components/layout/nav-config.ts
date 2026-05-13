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
} from "lucide-react";

export type NavItem = {
  href: string;
  /** Clé sous le namespace nav des fichiers de traduction. */
  labelKey:
    | "dashboard"
    | "announcements"
    | "cloud"
    | "messaging"
    | "classes"
    | "calendar"
    | "admin";
  icon: typeof LayoutDashboard;
  /** Si défini, exige la permission ; sinon visible pour tout le monde connecté. */
  permission?: Parameters<typeof hasPermission>[1];
  /** Réservé à direction + administrateurs (entrée du hub admin). */
  staffAdminOnly?: boolean;
};

export function buildNavItems(user: SessionUser | null): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/dashboard",
      labelKey: "dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/annonces",
      labelKey: "announcements",
      icon: Megaphone,
    },
    {
      href: "/cloud",
      labelKey: "cloud",
      icon: Cloud,
      permission: "UPLOAD_FILES",
    },
    {
      href: "/messagerie",
      labelKey: "messaging",
      icon: MessageSquare,
      permission: "SEND_MESSAGES",
    },
    {
      href: "/classes",
      labelKey: "classes",
      icon: Users,
    },
    {
      href: "/calendrier",
      labelKey: "calendar",
      icon: CalendarDays,
      permission: "VIEW_CALENDAR",
    },
  ];

  if (user && isStaffAdmin(user)) {
    items.push({
      href: "/admin",
      labelKey: "admin",
      icon: Shield,
      staffAdminOnly: true,
    });
  }

  return items.filter((item) => {
    if (!user) return false;
    if (item.staffAdminOnly) return isStaffAdmin(user);
    if (item.permission) return hasPermission(user, item.permission);
    return true;
  });
}
