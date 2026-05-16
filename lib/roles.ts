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
  if (!user) return false;
  if (isDirector(user) || user.role === "ADMINISTRATEUR") return true;
  if (user.role === "PEDAGO" && user.pedagoAdmin?.adminTeacherAccounts !== false)
    return true;
  return false;
}

export function isStudentUser(user: SessionUser | null): boolean {
  return user?.role === "ELEVE";
}

/** Fiches profil du personnel (`/profil/[id]`) : réservées aux collègues, pas aux élèves. */
export function canViewStaffDirectoryProfiles(user: SessionUser | null): boolean {
  if (!user) return false;
  return (
    user.role === "PROFESSEUR" ||
    user.role === "PROF_PRINCIPAL" ||
    user.role === "DIRECTEUR" ||
    user.role === "ADMINISTRATEUR" ||
    user.role === "PEDAGO"
  );
}

/** Fiche dossier élève (`/etudiants/[id]`) : personnel uniquement. */
export function canViewStudentDossierPage(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role !== "ELEVE";
}

export function profileRoleToUserRole(raw: string): UserRole {
  if (
    raw === "DIRECTEUR" ||
    raw === "ADMINISTRATEUR" ||
    raw === "PROF_PRINCIPAL" ||
    raw === "PROFESSEUR" ||
    raw === "PEDAGO" ||
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
