/**
 * URL et clé anon lues en priorité depuis des variables **sans** préfixe NEXT_PUBLIC_
 * pour qu’elles soient évaluées au runtime côté serveur (évite une URL obsolète
 * figée dans le chunk après changement de .env sans nettoyer .next).
 */
export function getSupabaseConnectionConfig(): { url: string; anonKey: string } {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  return { url, anonKey };
}
