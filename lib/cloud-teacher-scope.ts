import type { SessionUser } from "@/types";
import { pedagoNavAllows } from "@/lib/pedago-access";

/** Accès Cloud « tout l’établissement » : direction, administration, pédago (si autorisé). */
export function viewerHasEstablishmentCloudScope(user: SessionUser): boolean {
  if (user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR") return true;
  if (user.role === "PEDAGO" && pedagoNavAllows(user, "cloud")) return true;
  return false;
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
