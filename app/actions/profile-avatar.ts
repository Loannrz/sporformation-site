"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/session-server";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";

const MAX_BYTES = 10 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const ALLOWED_MIMES = new Set(Object.keys(MIME_TO_EXT));

export async function uploadMyAvatarAction(
  locale: AppLocale,
  formData: FormData,
): Promise<
  | { ok: true }
  | {
      ok: false;
      error:
        | "NO_SESSION"
        | "NO_DB"
        | "NO_FILE"
        | "FILE_TOO_LARGE"
        | "INVALID_TYPE"
        | "UPLOAD_FAILED"
        | "SAVE_FAILED";
      detail?: string;
    }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "NO_SESSION" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "NO_FILE" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIMES.has(mime)) {
    return { ok: false, error: "INVALID_TYPE" };
  }

  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const ext = MIME_TO_EXT[mime];
  const path = `${user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, {
      upsert: true,
      contentType: mime,
    });

  if (upErr) {
    return { ok: false, error: "UPLOAD_FAILED", detail: upErr.message };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (prof) {
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (pErr) {
      return { ok: false, error: "SAVE_FAILED", detail: pErr.message };
    }
  }

  if (user.studentId) {
    const { error: sErr } = await supabase
      .from("students")
      .update({ photo_url: publicUrl })
      .eq("id", user.studentId)
      .eq("auth_user_id", user.id);
    if (sErr) {
      return { ok: false, error: "SAVE_FAILED", detail: sErr.message };
    }
  }

  if (!prof && !user.studentId) {
    return {
      ok: false,
      error: "SAVE_FAILED",
      detail: "No profile or student row to attach the photo to.",
    };
  }

  await logActivity({
    ...actorFromSession(user),
    action: "PROFILE_AVATAR_UPDATED",
    entityType: "profile",
    entityId: user.id,
    meta: { mime, size_bytes: file.size },
  });

  revalidatePath(`/${locale}/parametres`);
  revalidatePath(`/${locale}`, "layout");
  return { ok: true };
}
