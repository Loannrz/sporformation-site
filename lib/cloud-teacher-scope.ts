import type { SessionUser } from "@/types";

/** Accès Cloud « tout l’établissement » : direction et administration. */
export function viewerHasEstablishmentCloudScope(user: SessionUser): boolean {
  return user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR";
}

/**
 * Classes accessibles pour un enseignant / PP dans le Cloud (titulaire ∪ affectations).
 * `null` = pas de limite par classe (élève, direction, admin).
 */
export function teacherCloudScopedClassIds(user: SessionUser): string[] | null {
  if (viewerHasEstablishmentCloudScope(user)) return null;
  if (user.role !== "PROFESSEUR" && user.role !== "PROF_PRINCIPAL") return null;
  const principal = user.principalClassIds ?? [];
  const assigned = user.assignedClassIds ?? [];
  return [...new Set([...principal, ...assigned])];
}
