"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import {
  ANNOUNCEMENT_ACCENT_KEYS,
  type AnnouncementAccentKey,
} from "@/lib/announcement-accents";
import {
  ANNOUNCEMENT_LOGO_IDS,
  type AnnouncementLogoId,
} from "@/lib/announcement-logos";
import type { AnnouncementAudience } from "@/types";
import {
  normalizeAnnouncementAudience,
} from "@/lib/announcement-audience";
import { hasPermission } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { announcementDescriptionToSafeHtml } from "@/lib/announcement-html";
import { notifyAnnouncementAudience } from "@/lib/email/notify-announcement";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function revalidateAnnouncementViews(locale: AppLocale) {
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/annonces`);
  revalidatePath(`/${locale}/admin/announcements`);
  revalidatePath(`/${locale}`, "layout");
}

const AUD_LIST: AnnouncementAudience[] = [
  "ALL_STAFF",
  "DIRECTION_ONLY",
  "HEAD_TEACHERS_ONLY",
  "CLASSROOM_TEACHERS",
];

function isAnnouncementAudience(raw: string): raw is AnnouncementAudience {
  return AUD_LIST.includes(raw as AnnouncementAudience);
}

export async function createAnnouncementAdminAction(
  locale: AppLocale,
  input: {
    title: string;
    description: string;
    logoKey: string;
    audience: string;
    accentKey: string;
  },
) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "CREATE_ANNOUNCEMENTS")) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) {
    return { ok: false as const, error: "TITLE_REQUIRED" as const };
  }
  if (!description) {
    return { ok: false as const, error: "DESCRIPTION_REQUIRED" as const };
  }

  const logoKeyRaw = input.logoKey.trim();
  const logoKey: AnnouncementLogoId =
    logoKeyRaw && (ANNOUNCEMENT_LOGO_IDS as readonly string[]).includes(logoKeyRaw)
      ? (logoKeyRaw as AnnouncementLogoId)
      : "megaphone";

  const audRaw = input.audience.trim();
  const audience = isAnnouncementAudience(audRaw)
    ? audRaw
    : normalizeAnnouncementAudience(undefined);

  const accentRaw = input.accentKey.trim();
  const accentKey: AnnouncementAccentKey =
    accentRaw &&
    (ANNOUNCEMENT_ACCENT_KEYS as readonly string[]).includes(accentRaw)
      ? (accentRaw as AnnouncementAccentKey)
      : "slate";

  const html = announcementDescriptionToSafeHtml(description);

  const { data: inserted, error } = await admin
    .from("announcements")
    .insert({
      title,
      html,
      importance: "normal",
      author_id: user.id,
      audience,
      logo_key: logoKey,
      accent: accentKey,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted?.id) {
    if (error) {
      console.error("announcement insert:", error.message);
    }
    return { ok: false as const, error: "INSERT_FAILED" as const };
  }

  await logActivity({
    ...actorFromSession(user),
    action: "ANNOUNCEMENT_CREATED",
    entityType: "announcement",
    entityId: inserted.id,
    entityLabel: title,
    meta: { audience },
  });

  revalidateAnnouncementViews(locale);

  try {
    await notifyAnnouncementAudience({
      admin,
      locale,
      audience,
      title,
      htmlBody: html,
      logoKey,
      accentKey,
    });
  } catch (e) {
    console.error("[annonces/email]", e);
  }

  return { ok: true as const };
}

export async function updateAnnouncementAdminAction(
  locale: AppLocale,
  announcementId: string,
  input: {
    title: string;
    description: string;
    logoKey: string;
    audience: string;
    accentKey: string;
  },
) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "CREATE_ANNOUNCEMENTS")) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  const id = announcementId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const { data: exists } = await admin
    .from("announcements")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!exists) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) {
    return { ok: false as const, error: "TITLE_REQUIRED" as const };
  }
  if (!description) {
    return { ok: false as const, error: "DESCRIPTION_REQUIRED" as const };
  }

  const logoKeyRaw = input.logoKey.trim();
  const logoKey: AnnouncementLogoId =
    logoKeyRaw && (ANNOUNCEMENT_LOGO_IDS as readonly string[]).includes(logoKeyRaw)
      ? (logoKeyRaw as AnnouncementLogoId)
      : "megaphone";

  const audRaw = input.audience.trim();
  const audience = isAnnouncementAudience(audRaw)
    ? audRaw
    : normalizeAnnouncementAudience(undefined);

  const accentRaw = input.accentKey.trim();
  const accentKey: AnnouncementAccentKey =
    accentRaw &&
    (ANNOUNCEMENT_ACCENT_KEYS as readonly string[]).includes(accentRaw)
      ? (accentRaw as AnnouncementAccentKey)
      : "slate";

  const html = announcementDescriptionToSafeHtml(description);

  const { error } = await admin
    .from("announcements")
    .update({
      title,
      html,
      audience,
      logo_key: logoKey,
      accent: accentKey,
    })
    .eq("id", id);

  if (error) {
    console.error("announcement update:", error.message);
    return { ok: false as const, error: "UPDATE_FAILED" as const };
  }

  await logActivity({
    ...actorFromSession(user),
    action: "ANNOUNCEMENT_UPDATED",
    entityType: "announcement",
    entityId: id,
    entityLabel: title,
    meta: { audience },
  });

  revalidateAnnouncementViews(locale);
  return { ok: true as const };
}

export async function deleteAnnouncementAdminAction(
  locale: AppLocale,
  announcementId: string,
) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "CREATE_ANNOUNCEMENTS")) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  const id = announcementId.trim();
  if (!UUID_RE.test(id)) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return { ok: false as const, error: "NO_SERVICE_ROLE" as const };
  }

  const { data: snapshot } = await admin
    .from("announcements")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  const snapTitle = (snapshot as { title?: string | null } | null)?.title ?? null;

  const { data: deleted, error } = await admin
    .from("announcements")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("announcement delete:", error.message);
    return { ok: false as const, error: "DELETE_FAILED" as const };
  }
  if (!deleted) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  await logActivity({
    ...actorFromSession(user),
    action: "ANNOUNCEMENT_DELETED",
    entityType: "announcement",
    entityId: id,
    entityLabel: snapTitle,
  });

  revalidateAnnouncementViews(locale);
  return { ok: true as const };
}
