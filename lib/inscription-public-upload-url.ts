export const INSCRIPTION_PUBLIC_UPLOAD_BUCKET_NAME = "public-uploads";

/** URL publique (bucket `public-uploads`) pour un chemin objet Storage. */
export function inscriptionPublicUploadUrl(storagePath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  const p = typeof storagePath === "string" ? storagePath.trim() : "";
  if (!base || !p) return null;
  const encoded = p
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
  const b = encodeURIComponent(INSCRIPTION_PUBLIC_UPLOAD_BUCKET_NAME);
  return `${base}/storage/v1/object/public/${b}/${encoded}`;
}
