import type { StaffClassCard } from "@/lib/data/school";
import { formatCloudClassDisplayName } from "@/lib/format-cloud-class-display-name";
import type { SessionUser } from "@/types";

/**
 * Identifiants des classes affichées dans `/classes`.
 * `null` : pas de filtre (direction, administration).
 * Tableau : uniquement ces classes (enseignants / PP).
 */
export function staffClassesPageScopedIds(user: SessionUser): string[] | null {
  if (user.role === "DIRECTEUR" || user.role === "ADMINISTRATEUR") return null;
  if (user.role === "PROFESSEUR" || user.role === "PROF_PRINCIPAL") {
    const principal = user.principalClassIds ?? [];
    const assigned = user.assignedClassIds ?? [];
    return [...new Set([...principal, ...assigned])];
  }
  return [];
}

export function viewerMayAccessClassPage(user: SessionUser, classId: string): boolean {
  const scoped = staffClassesPageScopedIds(user);
  if (scoped === null) return true;
  return scoped.includes(classId);
}

function classSortLabel(c: StaffClassCard): string {
  return formatCloudClassDisplayName(
    c.name,
    c.academicYearStart ?? null,
    c.academicYearEnd ?? null,
  );
}

/** Après filtre périmètre : PP — classes titulaires d’abord (ordre profil), puis autres affectations triées par libellé. */
export function filterAndOrderStaffClassCards(
  cards: StaffClassCard[],
  user: SessionUser,
): StaffClassCard[] {
  const scoped = staffClassesPageScopedIds(user);
  const list =
    scoped === null ? cards : cards.filter((c) => scoped.includes(c.id));

  if (scoped === null) {
    return list;
  }

  if (user.role !== "PROF_PRINCIPAL") {
    return [...list].sort((a, b) =>
      classSortLabel(a).localeCompare(classSortLabel(b), "fr", {
        sensitivity: "base",
      }),
    );
  }

  const principalOrder = user.principalClassIds ?? [];
  const principalSet = new Set(principalOrder);
  const byId = new Map(list.map((c) => [c.id, c]));

  const pinned: StaffClassCard[] = [];
  for (const id of principalOrder) {
    const card = byId.get(id);
    if (card) pinned.push(card);
  }

  const rest = list.filter((c) => !principalSet.has(c.id));
  rest.sort((a, b) =>
    classSortLabel(a).localeCompare(classSortLabel(b), "fr", {
      sensitivity: "base",
    }),
  );

  return [...pinned, ...rest];
}

export function isViewerPrincipalClassCard(
  classId: string,
  user: SessionUser,
): boolean {
  return (
    user.role === "PROF_PRINCIPAL" &&
    (user.principalClassIds ?? []).includes(classId)
  );
}
