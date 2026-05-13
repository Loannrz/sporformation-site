import type { SanctionType } from "@/types";

const FR: Record<SanctionType, string> = {
  avertissement: "Avertissement",
  punition: "Punition",
  sanction: "Sanction",
  retard: "Retard",
  absence: "Absence",
  comportement: "Comportement",
  autre: "Autre",
};

const EN: Record<SanctionType, string> = {
  avertissement: "Formal warning",
  punition: "Punishment",
  sanction: "Sanction",
  retard: "Lateness",
  absence: "Absence",
  comportement: "Behaviour",
  autre: "Other",
};

export function sanctionTypeLabel(type: SanctionType, locale: "fr" | "en") {
  return (locale === "en" ? EN : FR)[type];
}
