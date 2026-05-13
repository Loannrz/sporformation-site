/** Clés nav (next-intl) ou clés breadcrumb dédiées pour segments dynamiques. */
export type BreadcrumbLabelKey =
  | "dashboard"
  | "announcements"
  | "cloud"
  | "messaging"
  | "classes"
  | "calendar"
  | "admin"
  | "adminAnnouncements"
  | "adminCalendar"
  | "settings"
  | "profile"
  | "adminAccounts"
  | "adminClasses"
  | "adminStudents"
  | "students"
  | "detail"
  | "folder"
  | "conversation";

const STATIC: Record<string, BreadcrumbLabelKey> = {
  dashboard: "dashboard",
  annonces: "announcements",
  cloud: "cloud",
  messagerie: "messaging",
  classes: "classes",
  calendrier: "calendar",
  parametres: "settings",
  settings: "settings",
  profil: "profile",
  profile: "profile",
  administration: "admin",
  admin: "admin",
  comptes: "adminAccounts",
  users: "adminAccounts",
  etudiants: "students",
};

export function breadcrumbLabelKeyForSegment(
  segment: string,
  segments: string[],
  index: number,
): BreadcrumbLabelKey {
  const lower = segment.toLowerCase();
  const parent = index > 0 ? segments[index - 1]?.toLowerCase() : "";

  if (lower === "classes" && parent === "administration") {
    return "adminClasses";
  }

  if (lower === "students" && parent === "admin") {
    return "adminStudents";
  }

  if (lower === "announcements" && parent === "admin") {
    return "adminAnnouncements";
  }

  if (lower === "calendar" && parent === "admin") {
    return "adminCalendar";
  }

  if (lower === "roles" && parent === "administration") {
    return "admin";
  }

  if (lower === "logs" && parent === "admin") {
    return "admin";
  }

  if (STATIC[lower]) return STATIC[lower];

  if (parent === "etudiants" || parent === "classes" || parent === "comptes") {
    return "detail";
  }
  if (parent === "profil" || parent === "profile") {
    return "detail";
  }
  if (parent === "cloud") {
    return "folder";
  }
  if (parent === "messagerie") {
    return "conversation";
  }

  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    );
  if (uuidLike) return "detail";

  return "detail";
}
