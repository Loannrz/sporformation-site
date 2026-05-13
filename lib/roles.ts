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

export function profileRoleToUserRole(raw: string): UserRole {
  if (
    raw === "DIRECTEUR" ||
    raw === "ADMINISTRATEUR" ||
    raw === "PROF_PRINCIPAL" ||
    raw === "PROFESSEUR"
  ) {
    return raw;
  }
  return "PROFESSEUR";
}
