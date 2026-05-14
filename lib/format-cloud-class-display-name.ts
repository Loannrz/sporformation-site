/** Libellé classe pour nuage / administration (nom + années si disponibles). */
export function formatCloudClassDisplayName(
  name: string,
  academicYearStart: number | null,
  academicYearEnd: number | null,
): string {
  const y0 = academicYearStart;
  const y1 = academicYearEnd;
  if (
    y0 != null &&
    y1 != null &&
    Number.isFinite(y0) &&
    Number.isFinite(y1)
  ) {
    return `${name} – ${y0}–${y1}`;
  }
  return name;
}
