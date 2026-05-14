/** Codes d’erreur et résultat — partagés entre l’action serveur et les composants client (sans importer un module `"use server"`). */

export type UpdateCloudDocumentMetadataErrorCode =
  | "UNAUTH"
  | "FORBIDDEN"
  | "NO_SERVICE_ROLE"
  | "MISSING_FIELDS"
  | "INVALID_AUDIENCE"
  | "FILE_NOT_FOUND"
  | "STUDENT_UNKNOWN"
  | "STUDENT_CLASS_MISMATCH"
  | "UPDATE_FAILED";

export type UpdateCloudDocumentMetadataResult =
  | { ok: true }
  | {
      ok: false;
      error: UpdateCloudDocumentMetadataErrorCode;
      detail?: string;
    };
