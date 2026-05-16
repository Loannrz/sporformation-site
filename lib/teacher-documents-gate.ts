import type { SessionUser, TeacherEmploymentStatus, UserRole } from "@/types";

/** Chemins sans préfixe locale (ex. `/dashboard` après strip). */
const BYPASS_PREFIXES = [
  "/login",
  "/documents-a-fournir",
  "/acces-refuse",
] as const;

/**
 * True si la navigation vers ce chemin est autorisée pendant le gate
 * « documents enseignant ».
 */
export function teacherDocumentsGateBypassPath(pathWithoutLocale: string): boolean {
  const p = pathWithoutLocale === "" ? "/" : pathWithoutLocale.startsWith("/") ? pathWithoutLocale : `/${pathWithoutLocale}`;
  for (const prefix of BYPASS_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function computeTeacherDocumentsGateActive(input: {
  role: UserRole;
  teacherEmploymentStatus?: TeacherEmploymentStatus;
  teacherDocumentsApprovedAt?: string | null;
  teacherDocumentRequestCount: number;
}): boolean {
  if (input.role !== "PROFESSEUR" && input.role !== "PROF_PRINCIPAL") {
    return false;
  }
  if (input.teacherEmploymentStatus !== "NEW_TO_SCHOOL") return false;
  if (input.teacherDocumentsApprovedAt) return false;
  return input.teacherDocumentRequestCount > 0;
}

/** Mettre à jour le drapeau cohérent avec le middleware (comptage requis). */
export function sessionWithTeacherDocumentsGate(
  session: SessionUser,
  teacherDocumentRequestCount: number,
): SessionUser {
  const approvedRaw = session.teacherDocumentsApprovedAt;
  const gate = computeTeacherDocumentsGateActive({
    role: session.role,
    teacherEmploymentStatus: session.teacherEmploymentStatus,
    teacherDocumentsApprovedAt: approvedRaw,
    teacherDocumentRequestCount,
  });
  return {
    ...session,
    teacherDocumentRequestCount,
    teacherDocumentsGateActive: gate,
  };
}
