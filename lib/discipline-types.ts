import type { SanctionType } from "@/types";

/** Ordre d’affichage formulaires disciplinaires (catégories métier puis historique). */
export const SANCTION_FORM_TYPES_ORDER: SanctionType[] = [
  "avertissement",
  "punition",
  "sanction",
  "retard",
  "absence",
  "comportement",
  "autre",
];
