import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppOrigin } from "@/lib/email/app-origin";
import { sendTransactionalEmail } from "@/lib/email/resend-helpers";
import { fetchEmailsForAnnouncementAudience } from "@/lib/email/announcement-recipients";
import type { AppLocale } from "@/i18n/routing";
import type { AnnouncementAudience } from "@/types";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function notifyAnnouncementAudience(opts: {
  admin: SupabaseClient;
  locale: AppLocale;
  audience: AnnouncementAudience;
  title: string;
  htmlBody: string;
}): Promise<void> {
  const emails = await fetchEmailsForAnnouncementAudience(
    opts.admin,
    opts.audience,
  );
  if (emails.length === 0) return;

  const origin = resolveAppOrigin();
  const pathLocale = opts.locale === "en" ? "en" : "fr";
  const bulletinUrl = `${origin}/${pathLocale}/annonces`;
  const titleEsc = escapeHtml(opts.title.trim() || "Annonce");

  const headerFr =
    `<p>Une nouvelle annonce a été publiée sur SPORFORMATION.</p>` +
    `<p><a href="${bulletinUrl}">Voir le fil des annonces</a></p>` +
    `<hr />` +
    `<h2>${titleEsc}</h2>`;

  const headerEn =
    `<p>A new announcement was published on SPORFORMATION.</p>` +
    `<p><a href="${bulletinUrl}">Open announcements feed</a></p>` +
    `<hr />` +
    `<h2>${titleEsc}</h2>`;

  const body = opts.htmlBody.trim();

  await Promise.all(
    emails.map((to) =>
      sendTransactionalEmail({
        to,
        subject:
          opts.locale === "en"
            ? `[SPORFORMATION] New announcement — ${opts.title.trim() || "Announcement"}`
            : `[SPORFORMATION] Nouvelle annonce — ${opts.title.trim() || "Sans titre"}`,
        html:
          (opts.locale === "en" ? headerEn : headerFr) +
          (body.length > 0 ? body : `<p><em>${opts.locale === "en" ? "(No body)" : "(Pas de corps)"}</em></p>`),
      }),
    ),
  );
}
