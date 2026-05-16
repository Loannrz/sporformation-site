/** État du parcours « pièces à fournir » (aligné sur l’admin suivi). */
export type TeacherDocumentsTrackingState =
  | "missing"
  | "partial"
  | "submitted"
  | "ready"
  | "empty";

export function resolveTeacherDocumentsTrackingState(p: {
  totalRequests: number;
  filledRequests: number;
  teacher_documents_bundle_submitted_at: string | null;
}): TeacherDocumentsTrackingState {
  if (p.totalRequests === 0) return "empty";
  if (p.filledRequests === 0) return "missing";
  if (p.filledRequests < p.totalRequests) return "partial";
  if (p.teacher_documents_bundle_submitted_at) return "submitted";
  return "ready";
}
