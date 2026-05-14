/**
 * URL publique pour les liens dans les mails (sans slash final).
 * Définissez APP_ORIGIN en prod (ex. https://app.sporformation.fr).
 */
export function resolveAppOrigin(): string {
  const explicit =
    process.env.APP_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  return "http://localhost:3000";
}
