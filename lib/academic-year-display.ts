/** Entrées minimales pour libellés « classe + années » (client ou serveur). */
export type AdminClassOptionLabelInput = {
  name: string;
  academicYearStart: number | null;
  academicYearEnd: number | null;
};

/** Affichage « 2025–2027 » (tiret cadratin). */
export function formatAcademicYearRange(
  start?: number | null,
  end?: number | null,
): string | null {
  if (start == null && end == null) return null;
  if (start != null && end != null) return `${start}–${end}`;
  return String(start ?? end);
}

/** Liste déroulante : « Nom — 2025–2027 ». */
export function adminClassOptionLabel(c: AdminClassOptionLabelInput): string {
  const range = formatAcademicYearRange(c.academicYearStart, c.academicYearEnd);
  return range ? `${c.name} — ${range}` : c.name;
}
