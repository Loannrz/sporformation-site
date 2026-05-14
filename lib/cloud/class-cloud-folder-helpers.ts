/**
 * Helpers cloud « dossiers de classe » sans dépendance Next/SSR.
 * Importable depuis composants `"use client"`.
 */

/** Constante `system_kind` pour le dossier racine des dépôts élèves. */
export const STUDENT_INBOX_FOLDER_KIND = "STUDENT_INBOX";

/** Champs utilisés pour repérer l’inbox dans une liste plate. */
export type ClassCloudFolderLike = {
  id: string;
  name: string;
  parentId: string | null;
  systemKind: string | null;
};

export function getStudentInboxFolderId(
  rows: ClassCloudFolderLike[],
): string | null {
  const r = rows.find(
    (x) =>
      x.systemKind === STUDENT_INBOX_FOLDER_KIND ||
      (x.parentId === null && x.name.trim() === "Documents des élèves"),
  );
  return r?.id ?? null;
}
