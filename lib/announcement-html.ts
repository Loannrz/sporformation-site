function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texte utilisateur → paragraphes HTML échappés (annonces). */
export function announcementDescriptionToSafeHtml(description: string) {
  const parts = description
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);
  if (parts.length === 0) return "<p></p>";
  return parts.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

/** Inverse les paragraphes produits par `announcementDescriptionToSafeHtml` pour l’édition. */
export function announcementHtmlToPlainDescription(html: string): string {
  function decodeBasicEntities(segment: string) {
    return segment
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
  }
  const matches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
  if (matches.length > 0) {
    return matches
      .map((m) =>
        decodeBasicEntities(m[1])
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return decodeBasicEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
