import { hasPermission } from "@/lib/permissions";
import type { SessionUser, UserRole } from "@/types";

export function isDirector(user: SessionUser | null): boolean {
  return user?.role === "DIRECTEUR";
}

/** Direction ou administratif : accès au module administration (périmètre variable). */
export function isStaffAdmin(user: SessionUser | null): boolean {
  return user?.role === "DIRECTEUR" || user?.role === "ADMINISTRATEUR";
}

export function isClassPrincipal(user: SessionUser | null): boolean {
  return user?.role === "PROF_PRINCIPAL";
}

/** Actions réservées au directeur (suppressions comptes, organigramme, classes admin…). */
export function isDirectorOnlyAction(user: SessionUser | null): boolean {
  return isDirector(user);
}

/** Rôles élevés pouvant gérer les comptes enseignants (sans tout le périmètre directeur). */
export function canManageTeacherAccounts(user: SessionUser | null): boolean {
  return isDirector(user) || user?.role === "ADMINISTRATEUR";
}

export function isStudentUser(user: SessionUser | null): boolean {
  return user?.role === "ELEVE";
}

export function profileRoleToUserRole(raw: string): UserRole {
  if (
    raw === "DIRECTEUR" ||
    raw === "ADMINISTRATEUR" ||
    raw === "PROF_PRINCIPAL" ||
    raw === "PROFESSEUR" ||
    raw === "ELEVE"
  ) {
    return raw;
  }
  return "PROFESSEUR";
}

/** Sous-dossiers dans « Documents des élèves » (bouton depuis le Cloud classe). */
export function mayCreateStudentInboxSubfolder(
  user: SessionUser | null,
  classId: string,
): boolean {
  if (!user || user.role === "ELEVE") return false;
  if (!hasPermission(user, "UPLOAD_FILES")) return false;
  if (user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR") {
    return true;
  }
  if (user.role === "PROF_PRINCIPAL") {
    return user.principalClassIds?.includes(classId) ?? false;
  }
  return user.role === "PROFESSEUR";
}
