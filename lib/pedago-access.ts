import { redirectToAccessDenied } from "@/lib/guards";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import type { AppLocale } from "@/i18n/routing";
import type {
  PedagoAdminFlagKey,
  PedagoNavFlagKey,
  PermissionKey,
  SessionUser,
} from "@/types";

export type { PedagoAdminFlagKey, PedagoNavFlagKey } from "@/types";

/** Navigation principale (hors module admin). */
export const PEDAGO_NAV_KEYS: readonly PedagoNavFlagKey[] = [
  "dashboard",
  "announcements",
  "cloud",
  "messaging",
  "classes",
  "calendar",
  "sanctionsHub",
  "disciplineWarning",
];

/** Tuiles « administration » (hub /admin ou /administration). */
export const PEDAGO_ADMIN_KEYS: readonly PedagoAdminFlagKey[] = [
  "adminClasses",
  "adminTeacherAccounts",
  "adminStudents",
  "adminCalendar",
  "adminAnnouncements",
  "adminSanctions",
  "adminLeadForms",
  "adminInscriptionSubmissions",
  "adminHistory",
  "adminStaffDirectory",
];

const NAV_DEFAULTS: Record<PedagoNavFlagKey, boolean> = {
  dashboard: true,
  announcements: true,
  cloud: true,
  messaging: true,
  classes: true,
  calendar: true,
  sanctionsHub: true,
  disciplineWarning: true,
};

const ADMIN_DEFAULTS: Record<PedagoAdminFlagKey, boolean> = {
  adminClasses: true,
  adminTeacherAccounts: true,
  adminStudents: true,
  adminCalendar: true,
  adminAnnouncements: true,
  adminSanctions: true,
  adminLeadForms: true,
  adminInscriptionSubmissions: true,
  adminHistory: true,
  adminStaffDirectory: true,
};

export function mergePedagoNavFromDb(raw: unknown): Record<PedagoNavFlagKey, boolean> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...NAV_DEFAULTS };
  for (const k of PEDAGO_NAV_KEYS) {
    if (typeof o[k] === "boolean") out[k] = o[k];
  }
  return out;
}

export function mergePedagoAdminFromDb(raw: unknown): Record<PedagoAdminFlagKey, boolean> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...ADMIN_DEFAULTS };
  for (const k of PEDAGO_ADMIN_KEYS) {
    if (typeof o[k] === "boolean") out[k] = o[k];
  }
  return out;
}

export function isPedago(user: SessionUser | null): boolean {
  return user?.role === "PEDAGO";
}

export function pedagoNavAllows(user: SessionUser, key: PedagoNavFlagKey): boolean {
  if (user.role !== "PEDAGO") return true;
  const v = user.pedagoNav?.[key];
  return v !== false;
}

export function pedagoAdminAllows(user: SessionUser, key: PedagoAdminFlagKey): boolean {
  if (user.role !== "PEDAGO") return true;
  const v = user.pedagoAdmin?.[key];
  return v !== false;
}

export function pedagoHasAnyAdminAccess(user: SessionUser | null): boolean {
  if (!user || user.role !== "PEDAGO") return false;
  for (const k of PEDAGO_ADMIN_KEYS) {
    if (pedagoAdminAllows(user, k)) return true;
  }
  return false;
}

/** Accès à l’entrée « Admin » dans la sidebar / au hub. */
export function canOpenAdministrationHub(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  return pedagoHasAnyAdminAccess(user);
}

export function canManageSchoolCalendarAsStaff(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminCalendar");
}

export function canManageSanctionsHubAsStaff(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminSanctions");
}

export function canAccessStudentAdministration(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminStudents");
}

export function canManageLeadForms(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isDirector(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminLeadForms");
}

export function canManageInscriptionSubmissions(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminInscriptionSubmissions");
}

export function canAccessClassesManagementAdmin(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isDirector(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminClasses");
}

export function canAccessActivityHistoryAdmin(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isDirector(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminHistory");
}

export function canAccessInternalAnnouncementsAdmin(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminAnnouncements");
}

export function canAccessStaffDirectoryAdmin(user: SessionUser | null): boolean {
  if (!user) return false;
  if (isStaffAdmin(user)) return true;
  return user.role === "PEDAGO" && pedagoAdminAllows(user, "adminStaffDirectory");
}

export function enforcePedagoNav(
  user: SessionUser | null,
  locale: AppLocale,
  key: PedagoNavFlagKey,
): void {
  if (!user || user.role !== "PEDAGO") return;
  if (!pedagoNavAllows(user, key)) redirectToAccessDenied(locale);
}

const HUB_HREF_TO_ADMIN_FLAG: Partial<Record<string, PedagoAdminFlagKey>> = {
  "/administration/classes": "adminClasses",
  "/admin/users": "adminStaffDirectory",
  "/admin/students": "adminStudents",
  "/admin/calendar": "adminCalendar",
  "/sanctions": "adminSanctions",
  "/admin/announcements": "adminAnnouncements",
  "/admin/lead-forms": "adminLeadForms",
  "/admin/inscription-submissions": "adminInscriptionSubmissions",
  "/admin/history": "adminHistory",
};

export function pedagoCanAccessHubHref(user: SessionUser, href: string): boolean {
  const key = HUB_HREF_TO_ADMIN_FLAG[href];
  if (!key) return false;
  return pedagoAdminAllows(user, key);
}

export function filterPedagoAdminHubHrefs(
  user: SessionUser,
  hrefs: string[],
): string[] {
  return hrefs.filter((h) => pedagoCanAccessHubHref(user, h));
}

/** Permissions effectives pour les comptes pédago (hors élève/autres rôles). */
export function pedagoHasPermission(user: SessionUser, key: PermissionKey): boolean {
  const n = user.pedagoNav ?? NAV_DEFAULTS;
  const a = user.pedagoAdmin ?? ADMIN_DEFAULTS;

  switch (key) {
    case "UPLOAD_FILES":
    case "DELETE_OWN_FILES":
      return n.cloud;
    case "SEND_MESSAGES":
      return n.messaging;
    case "VIEW_CALENDAR":
      return n.calendar;
    case "MANAGE_CALENDAR":
      return n.calendar && a.adminCalendar;
    case "VIEW_SANCTIONS":
      return n.sanctionsHub;
    case "ADD_SANCTION":
      return n.disciplineWarning;
    case "CREATE_ANNOUNCEMENTS":
      return n.announcements;
    case "CREATE_TEACHER_ACCOUNTS":
      return a.adminTeacherAccounts;
    case "CREATE_STUDENT_PROFILES":
      return a.adminStudents;
    case "MANAGE_CLASSES":
    case "ASSIGN_CLASS_PRINCIPAL":
      return a.adminClasses;
    case "VIEW_FULL_SANCTION_HISTORY":
    case "REMOVE_ANY_SANCTION":
      return a.adminSanctions;
    case "VIEW_DIRECTOR_DASHBOARD":
    case "DELETE_ACCOUNTS":
    case "MANAGE_ROLES":
    case "DELETE_ALL_FILES":
    case "REMOVE_OWN_CLASS_SANCTION":
    case "ACCESS_STUDENT_CLOUD":
    default:
      return false;
  }
}
