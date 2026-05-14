import type { UserRole } from "@/types";

/** Audience cible d’un fichier Cloud (formulaire dépôt). */
export type CloudDocumentAudience = "STUDENTS" | "STAFF" | "BOTH";

export function normalizeCloudDocumentAudience(
  raw: string | null | undefined,
): CloudDocumentAudience {
  if (
    raw === "STUDENTS" ||
    raw === "STAFF" ||
    raw === "BOTH"
  ) {
    return raw;
  }
  return "BOTH";
}

export function parseCloudDocumentAudienceFromForm(
  raw: string | null | undefined,
): CloudDocumentAudience | null {
  const s = raw == null ? "" : String(raw).trim();
  if (s === "STUDENTS" || s === "STAFF" || s === "BOTH") {
    return s;
  }
  return null;
}

/**
 * Qui voit ce document dans le Cloud (liste / dossiers / compteurs).
 * STAFF : direction, administration et PP — pas les professeurs seuls.
 */
export function viewerSeesCloudDocumentAudience(
  role: UserRole,
  audience: CloudDocumentAudience,
): boolean {
  if (role === "ELEVE") {
    return audience === "STUDENTS" || audience === "BOTH";
  }
  if (audience === "BOTH" || audience === "STUDENTS") {
    return true;
  }
  return (
    role === "DIRECTEUR" ||
    role === "ADMINISTRATEUR" ||
    role === "PROF_PRINCIPAL"
  );
}

/** Filtre liste + sous-dossiers sur la page Cloud d’une classe. BOTH compte dans les deux. */
export type CloudClassFolderAudienceTab =
  | "administration"
  | "students";

export function fileMatchesCloudClassFolderAudienceTab(
  audience: CloudDocumentAudience,
  tab: CloudClassFolderAudienceTab,
): boolean {
  if (tab === "administration") {
    return audience === "STAFF" || audience === "BOTH";
  }
  return audience === "STUDENTS" || audience === "BOTH";
}

/** Onglet par défaut : priorité vue « cours » si des documents existent pour ce filtre. */
export function deriveClassFolderDefaultAudienceTab(
  audiences: CloudDocumentAudience[],
): CloudClassFolderAudienceTab {
  if (
    audiences.some((a) => fileMatchesCloudClassFolderAudienceTab(a, "students"))
  ) {
    return "students";
  }
  if (
    audiences.some((a) =>
      fileMatchesCloudClassFolderAudienceTab(a, "administration"),
    )
  ) {
    return "administration";
  }
  return "students";
}
