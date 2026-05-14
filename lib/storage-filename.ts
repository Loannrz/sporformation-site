/**
 * Supabase Storage rejects many non-ASCII characters in object keys ("Invalid key").
 * Normalize to ASCII-ish names safe for paths while keeping spaces and common punctuation.
 */
export function sanitizeStorageObjectFileName(
  name: string,
  fallback = "document",
): string {
  const base = String(name ?? "")
    .replace(/^.*[/\\]/, "")
    .replace(/\u0000/g, "")
    .trim();

  const asciiLike = base
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");

  let safe = asciiLike.replace(/[^a-zA-Z0-9._\- '()]+/g, "_");
  safe = safe.replace(/_+/g, "_").replace(/^_|_$/g, "");
  const trimmed = safe.slice(0, 180);
  return trimmed.length ? trimmed : fallback;
}
