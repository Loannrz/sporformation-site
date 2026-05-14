import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppOrigin } from "@/lib/email/app-origin";
import { sendTransactionalEmail } from "@/lib/email/resend-helpers";
import { fetchEmailsForAnnouncementAudience } from "@/lib/email/announcement-recipients";
import {
  accentPalette,
  escapeHtml,
  EMAIL_PALETTE,
  renderBadge,
  renderEmailShell,
  renderHtmlBlock,
  siteCtaLabel,
} from "@/lib/email/shell";
import type { AppLocale } from "@/i18n/routing";
import type { AnnouncementAudience } from "@/types";
import {
  normalizeAnnouncementLogoId,
  type AnnouncementLogoId,
} from "@/lib/announcement-logos";

/** Glyphe Unicode neutre par logoKey (compatibilité maximale tous clients mail). */
const LOGO_GLYPH: Record<AnnouncementLogoId, string> = {
  megaphone: "📣",
  bell: "🔔",
  calendar: "📅",
  graduation: "🎓",
  school: "🏫",
  info: "ℹ️",
  sparkle: "✨",
};

function audienceLabel(audience: AnnouncementAudience, locale: AppLocale): string {
  if (locale === "en") {
    switch (audience) {
      case "ALL_STAFF":
        return "All staff";
      case "DIRECTION_ONLY":
        return "Leadership (+ admin)";
      case "HEAD_TEACHERS_ONLY":
        return "Lead teachers only";
      case "CLASSROOM_TEACHERS":
        return "Teachers (+ lead)";
    }
  }
  switch (audience) {
    case "ALL_STAFF":
      return "Tout le personnel";
    case "DIRECTION_ONLY":
      return "Direction (+ admin)";
    case "HEAD_TEACHERS_ONLY":
      return "PP seulement";
    case "CLASSROOM_TEACHERS":
      return "Profs (+ PP)";
  }
}

function renderAnnouncementHero(opts: {
  glyph: string;
  title: string;
  audienceText: string;
  dateLabel: string;
  authorLabel: string;
  accent: ReturnType<typeof accentPalette>;
}): string {
  const { glyph, title, audienceText, dateLabel, authorLabel, accent } = opts;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${accent.softBorder};background:${accent.soft};border-radius:14px;margin-bottom:14px;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="width:64px;padding-right:14px;">
                <div style="width:56px;height:56px;border-radius:16px;background:#FFFFFF;border:1px solid ${accent.softBorder};text-align:center;line-height:56px;font-size:28px;">${glyph}</div>
              </td>
              <td valign="top">
                <div style="margin-bottom:6px;">${renderBadge({ label: audienceText, accent })}</div>
                <div style="font-size:18px;font-weight:800;color:${EMAIL_PALETTE.INK};line-height:1.3;margin-bottom:4px;">${escapeHtml(title)}</div>
                <div style="font-size:12px;color:${EMAIL_PALETTE.MUTED};">${escapeHtml(authorLabel)} · ${escapeHtml(dateLabel)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export async function notifyAnnouncementAudience(opts: {
  admin: SupabaseClient;
  locale: AppLocale;
  audience: AnnouncementAudience;
  title: string;
  htmlBody: string;
  /** Identifiant du logo prédéfini (mêmes valeurs que la carte annonce). */
  logoKey?: string | null;
  /** Identifiant d’accent (mêmes valeurs que la carte annonce). */
  accentKey?: string | null;
}): Promise<void> {
  const emails = await fetchEmailsForAnnouncementAudience(
    opts.admin,
    opts.audience,
  );
  if (emails.length === 0) return;

  const origin = resolveAppOrigin();
  const pathLocale = opts.locale === "en" ? "en" : "fr";
  const bulletinUrl = `${origin}/${pathLocale}/annonces`;
  const dashboardUrl = `${origin}/${pathLocale}/dashboard`;

  const accent = accentPalette(opts.accentKey ?? "slate");
  const logoId = normalizeAnnouncementLogoId(opts.logoKey ?? "megaphone");
  const glyph = LOGO_GLYPH[logoId] ?? "📣";

  const cleanTitle = opts.title.trim();
  const titleForShell =
    cleanTitle ||
    (opts.locale === "en" ? "New announcement" : "Nouvelle annonce");

  const audText = audienceLabel(opts.audience, opts.locale);
  const dateLabel = new Date().toLocaleDateString(
    opts.locale === "en" ? "en-US" : "fr-FR",
    { day: "numeric", month: "long", year: "numeric" },
  );
  const authorLabel =
    opts.locale === "en"
      ? "Direction / administration"
      : "Direction / administration";

  const hero = renderAnnouncementHero({
    glyph,
    title: titleForShell,
    audienceText: audText,
    dateLabel,
    authorLabel,
    accent,
  });

  const body = opts.htmlBody.trim();
  const bodyHtml = body.length > 0
    ? body
    : `<p style="margin:0;color:${EMAIL_PALETTE.MUTED};font-style:italic;">${
        opts.locale === "en" ? "(No additional details)" : "(Pas de détails complémentaires)"
      }</p>`;

  const bodyBlock = renderHtmlBlock({
    label: opts.locale === "en" ? "Announcement" : "Annonce",
    html: bodyHtml,
    accent,
  });

  const intro =
    opts.locale === "en"
      ? "A new announcement was just published on SPORFORMATION. The full message is below."
      : "Une nouvelle annonce vient d’être publiée sur SPORFORMATION. Vous retrouvez ci-dessous le message complet.";

  const kicker =
    opts.locale === "en" ? "New announcement" : "Nouvelle annonce";

  const preheader =
    opts.locale === "en"
      ? `New announcement — ${titleForShell}`
      : `Nouvelle annonce — ${titleForShell}`;

  const ctaLabel =
    opts.locale === "en" ? "Open announcements feed" : "Ouvrir le fil des annonces";

  const html = renderEmailShell({
    locale: opts.locale,
    preheader,
    kicker,
    title: titleForShell,
    intro,
    bodyHtml: `${hero}${bodyBlock}`,
    accent,
    primaryCta: { url: bulletinUrl, label: ctaLabel },
    secondaryCta: { url: dashboardUrl, label: siteCtaLabel(opts.locale) },
  });

  const subject =
    opts.locale === "en"
      ? `[SPORFORMATION] New announcement — ${cleanTitle || "Announcement"}`
      : `[SPORFORMATION] Nouvelle annonce — ${cleanTitle || "Sans titre"}`;

  await Promise.all(
    emails.map((to) =>
      sendTransactionalEmail({
        to,
        subject,
        html,
      }),
    ),
  );
}
