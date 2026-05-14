import type { PermissionKey, Sanction, SessionUser } from "@/types";

const directorAllows: Partial<Record<PermissionKey, true>> = {
  CREATE_TEACHER_ACCOUNTS: true,
  CREATE_STUDENT_PROFILES: true,
  DELETE_ACCOUNTS: true,
  MANAGE_ROLES: true,
  MANAGE_CLASSES: true,
  ASSIGN_CLASS_PRINCIPAL: true,
  UPLOAD_FILES: true,
  DELETE_ALL_FILES: true,
  ADD_SANCTION: true,
  REMOVE_ANY_SANCTION: true,
  VIEW_SANCTIONS: true,
  VIEW_FULL_SANCTION_HISTORY: true,
  SEND_MESSAGES: true,
  CREATE_ANNOUNCEMENTS: true,
  VIEW_DIRECTOR_DASHBOARD: true,
  MANAGE_CALENDAR: true,
  VIEW_CALENDAR: true,
};

/** Administrateur : gestion courante sans suppression de comptes ni organigramme global. */
const administratorAllows: Partial<Record<PermissionKey, true>> = {
  CREATE_TEACHER_ACCOUNTS: true,
  CREATE_STUDENT_PROFILES: true,
  MANAGE_CLASSES: true,
  ASSIGN_CLASS_PRINCIPAL: true,
  UPLOAD_FILES: true,
  DELETE_OWN_FILES: true,
  ADD_SANCTION: true,
  REMOVE_ANY_SANCTION: true,
  VIEW_SANCTIONS: true,
  VIEW_FULL_SANCTION_HISTORY: true,
  SEND_MESSAGES: true,
  CREATE_ANNOUNCEMENTS: true,
  MANAGE_CALENDAR: true,
  VIEW_CALENDAR: true,
};

const principalAllows: Partial<Record<PermissionKey, true>> = {
  UPLOAD_FILES: true,
  ADD_SANCTION: true,
  VIEW_SANCTIONS: true,
  SEND_MESSAGES: true,
  VIEW_CALENDAR: true,
  MANAGE_CALENDAR: true,
};

const professorAllows: Partial<Record<PermissionKey, true>> = {
  UPLOAD_FILES: true,
  ADD_SANCTION: true,
  VIEW_SANCTIONS: true,
  SEND_MESSAGES: true,
  VIEW_CALENDAR: true,
};

/** Hub / liste « sanctions actives » : personnel avec VIEW_SANCTIONS, ou élève (ses propres sanctions). */
export function canAccessSanctionsHub(user: SessionUser | null): boolean {
  if (!user) return false;
  if (user.role === "ELEVE") return Boolean(user.studentId);
  return hasPermission(user, "VIEW_SANCTIONS");
}

export function hasPermission(user: SessionUser | null, key: PermissionKey) {
  if (!user) return false;
  if (user.role === "ELEVE") {
    return key === "ACCESS_STUDENT_CLOUD" || key === "SEND_MESSAGES";
  }
  if (user.role === "DIRECTEUR") return directorAllows[key] === true;
  if (user.role === "ADMINISTRATEUR") return administratorAllows[key] === true;
  if (user.role === "PROF_PRINCIPAL") return principalAllows[key] === true;
  return professorAllows[key] === true;
}

/** Fiche élève : tous les signalements lorsque l’utilisateur peut consulter les sanctions (plus de filtre « actives seules » pour les professeurs). */
export function sanctionsForStudentProfile(
  user: SessionUser | null,
  _studentClassId: string,
  sanctions: Sanction[],
): Sanction[] {
  if (!user || !hasPermission(user, "VIEW_SANCTIONS")) return [];
  return sanctions;
}

export function canRemoveSanction(
  user: SessionUser | null,
  sanction: Sanction,
  studentClassId: string | undefined,
) {
  if (!user || sanction.status === "retired") return false;
  if (user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR") {
    return directorAllows.REMOVE_ANY_SANCTION === true;
  }
  if (user.role === "PROF_PRINCIPAL") {
    if (!studentClassId) return false;
    return user.principalClassIds?.includes(studentClassId) ?? false;
  }
  return false;
}

export function canViewRemovedHistory(user: SessionUser | null) {
  return Boolean(
    user?.role === "DIRECTEUR" || user?.role === "ADMINISTRATEUR",
  );
}

export function canDownloadSanctionPdf(
  user: SessionUser | null,
  studentClassId: string,
) {
  if (!user) return false;
  if (user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR") {
    return true;
  }
  if (user.role === "PROF_PRINCIPAL") {
    return user.principalClassIds?.includes(studentClassId) ?? false;
  }
  return false;
}
