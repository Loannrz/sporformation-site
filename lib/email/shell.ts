import type { AppLocale } from "@/i18n/routing";

/**
 * Design system mutualisé pour les mails transactionnels SPORFORMATION.
 *
 * Toutes les cartes utilisent des tables imbriquées (compatibilité clients mail
 * historiques) et la palette interne (rouge / orange / encre) sans dépendre de
 * polices web ni d’images distantes.
 */

export const EMAIL_PALETTE = {
  RED: "#E63946",
  ORANGE: "#F4A261",
  INK: "#0F172A",
  INK_SOFT: "#1F2937",
  MUTED: "#64748B",
  MUTED_2: "#94A3B8",
  BORDER: "#E2E8F0",
  BORDER_SOFT: "#EEF2F7",
  SOFT_BG: "#F8FAFC",
  WHITE: "#FFFFFF",
} as const;

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type EmailAccentKey =
  | "slate"
  | "emerald"
  | "rose"
  | "sky"
  | "amber"
  | "violet"
  | "orange"
  | "red";

export type EmailAccentPalette = {
  solid: string;
  soft: string;
  softBorder: string;
  text: string;
};

const ACCENT_TABLE: Record<EmailAccentKey, EmailAccentPalette> = {
  slate: { solid: "#475569", soft: "#F1F5F9", softBorder: "#E2E8F0", text: "#0F172A" },
  emerald: { solid: "#059669", soft: "#ECFDF5", softBorder: "#A7F3D0", text: "#065F46" },
  rose: { solid: "#E11D48", soft: "#FFF1F2", softBorder: "#FECDD3", text: "#9F1239" },
  sky: { solid: "#0284C7", soft: "#F0F9FF", softBorder: "#BAE6FD", text: "#075985" },
  amber: { solid: "#D97706", soft: "#FFFBEB", softBorder: "#FDE68A", text: "#92400E" },
  violet: { solid: "#7C3AED", soft: "#F5F3FF", softBorder: "#DDD6FE", text: "#5B21B6" },
  orange: { solid: "#EA580C", soft: "#FFF7ED", softBorder: "#FED7AA", text: "#9A3412" },
  red: { solid: "#E63946", soft: "#FFF1F2", softBorder: "#FECDD3", text: "#9F1239" },
};

export function accentPalette(
  key: string | null | undefined,
): EmailAccentPalette {
  if (key && key in ACCENT_TABLE) {
    return ACCENT_TABLE[key as EmailAccentKey];
  }
  return ACCENT_TABLE.red;
}

/** Pavé "Accéder au site" — bouton bulletproof (table, pas de CSS exotique). */
export function renderCtaButton(opts: {
  url: string;
  label: string;
  color?: string;
}): string {
  const color = opts.color ?? EMAIL_PALETTE.RED;
  const url = opts.url;
  const label = escapeHtml(opts.label);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px 0;">
      <tr>
        <td align="center" bgcolor="${color}" style="border-radius:10px;">
          <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.3px;color:#FFFFFF;text-decoration:none;border-radius:10px;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/** Lien secondaire discret sous le bouton principal. */
export function renderSecondaryLink(opts: {
  url: string;
  label: string;
}): string {
  return `
    <p style="margin:0 0 4px 0;font-size:12px;color:${EMAIL_PALETTE.MUTED};">
      <a href="${opts.url}" target="_blank" rel="noopener" style="color:${EMAIL_PALETTE.MUTED};text-decoration:underline;">${escapeHtml(opts.label)}</a>
    </p>`;
}

/** Petite étiquette d’audience / statut. */
export function renderBadge(opts: {
  label: string;
  accent?: EmailAccentPalette;
}): string {
  const a = opts.accent ?? ACCENT_TABLE.slate;
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${a.soft};border:1px solid ${a.softBorder};color:${a.text};font-size:11px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">${escapeHtml(opts.label)}</span>`;
}

/** Carte d’infos clé/valeur sur 2 colonnes. */
export function renderInfoCard(rows: { label: string; value: string }[]): string {
  const tds = rows.map(
    ({ label, value }) => `
            <td valign="top" style="width:50%;padding:14px 14px;">
              <div style="font-size:10px;font-weight:700;color:${EMAIL_PALETTE.MUTED};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(label)}</div>
              <div style="font-size:14px;font-weight:700;color:${EMAIL_PALETTE.INK};">${escapeHtml(value || "—")}</div>
            </td>`,
  );

  const rowsHtml: string[] = [];
  for (let i = 0; i < tds.length; i += 2) {
    const right = tds[i + 1] ?? `<td style="width:50%;"></td>`;
    rowsHtml.push(`<tr>${tds[i]}${right}</tr>`);
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${EMAIL_PALETTE.BORDER};border-radius:10px;background:#FFFFFF;margin-bottom:14px;">
      ${rowsHtml.join("")}
    </table>`;
}

/** Pilule "type d’action" (motif sanction, type d’annonce…). */
export function renderTypePill(opts: {
  label: string;
  value: string;
  accent?: EmailAccentPalette;
}): string {
  const a = opts.accent ?? ACCENT_TABLE.red;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:${a.soft};border-left:4px solid ${a.solid};padding:14px 16px;border-radius:6px;">
          <div style="font-size:10px;font-weight:700;color:${a.solid};letter-spacing:1.4px;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(opts.label)}</div>
          <div style="font-size:17px;font-weight:700;color:${EMAIL_PALETTE.INK};">${escapeHtml(opts.value)}</div>
        </td>
      </tr>
    </table>`;
}

/** Bloc descriptif (texte brut → on échappe + on respecte les sauts de ligne). */
export function renderDescription(opts: {
  label: string;
  body: string;
  accent?: EmailAccentPalette;
}): string {
  const a = opts.accent ?? ACCENT_TABLE.red;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:${EMAIL_PALETTE.SOFT_BG};border:1px solid ${EMAIL_PALETTE.BORDER};border-radius:10px;padding:16px;">
          <div style="margin-bottom:6px;">
            <span style="display:inline-block;width:4px;height:14px;background:${a.solid};margin-right:8px;vertical-align:middle;"></span>
            <span style="font-size:12px;font-weight:700;color:${EMAIL_PALETTE.INK};letter-spacing:0.3px;vertical-align:middle;">${escapeHtml(opts.label)}</span>
          </div>
          <div style="font-size:13px;color:${EMAIL_PALETTE.INK};line-height:1.55;white-space:pre-wrap;">${escapeHtml(opts.body)}</div>
        </td>
      </tr>
    </table>`;
}

/** Bloc descriptif quand on a déjà du HTML sûr (annonces). */
export function renderHtmlBlock(opts: {
  label: string;
  html: string;
  accent?: EmailAccentPalette;
}): string {
  const a = opts.accent ?? ACCENT_TABLE.red;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#FFFFFF;border:1px solid ${EMAIL_PALETTE.BORDER};border-radius:10px;padding:18px 20px;">
          <div style="margin-bottom:10px;">
            <span style="display:inline-block;width:4px;height:14px;background:${a.solid};margin-right:8px;vertical-align:middle;"></span>
            <span style="font-size:12px;font-weight:700;color:${EMAIL_PALETTE.INK};letter-spacing:0.3px;vertical-align:middle;">${escapeHtml(opts.label)}</span>
          </div>
          <div style="font-size:14.5px;color:${EMAIL_PALETTE.INK};line-height:1.65;">${opts.html}</div>
        </td>
      </tr>
    </table>`;
}

/** Citation type "aperçu de message". */
export function renderQuoteBlock(opts: {
  authorLabel: string;
  authorName: string;
  bodyHtml: string;
  accent?: EmailAccentPalette;
}): string {
  const a = opts.accent ?? ACCENT_TABLE.red;
  const initials = computeInitials(opts.authorName);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;border:1px solid ${EMAIL_PALETTE.BORDER};border-radius:12px;background:#FFFFFF;">
      <tr>
        <td style="padding:16px 18px 6px 18px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" style="padding-right:12px;">
                <div style="width:38px;height:38px;border-radius:999px;background:${a.solid};color:#FFFFFF;font-size:14px;font-weight:700;line-height:38px;text-align:center;letter-spacing:0.6px;">${escapeHtml(initials)}</div>
              </td>
              <td valign="middle">
                <div style="font-size:10px;font-weight:700;color:${EMAIL_PALETTE.MUTED};letter-spacing:1.4px;text-transform:uppercase;margin-bottom:2px;">${escapeHtml(opts.authorLabel)}</div>
                <div style="font-size:15px;font-weight:700;color:${EMAIL_PALETTE.INK};">${escapeHtml(opts.authorName)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 18px 18px 18px;">
          <div style="border-left:3px solid ${a.solid};padding:6px 14px;background:${a.soft};border-radius:0 8px 8px 0;font-size:14px;color:${EMAIL_PALETTE.INK};line-height:1.55;">${opts.bodyHtml}</div>
        </td>
      </tr>
    </table>`;
}

/** Liste d’élèves (sanctions de classe). */
export function renderStudentList(opts: {
  label: string;
  names: string[];
}): string {
  const items = opts.names
    .map(
      (n) =>
        `<li style="margin:0 0 4px 0;font-size:13px;color:${EMAIL_PALETTE.INK};">${escapeHtml(n)}</li>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#FFFFFF;border:1px solid ${EMAIL_PALETTE.BORDER};border-radius:10px;padding:16px;">
          <div style="font-size:12px;font-weight:700;color:${EMAIL_PALETTE.INK};letter-spacing:0.3px;margin-bottom:8px;">${escapeHtml(opts.label)}</div>
          <ul style="margin:0;padding-left:18px;">${items}</ul>
        </td>
      </tr>
    </table>`;
}

function computeInitials(name: string): string {
  const parts = name
    .replace(/[<>"'`]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export type EmailShellOptions = {
  locale: AppLocale;
  preheader: string;
  kicker: string;
  title: string;
  intro: string;
  bodyHtml: string;
  /** Couleur d’accent appliquée au bandeau supérieur. */
  accent?: EmailAccentPalette;
  /** Bouton CTA principal (très visible, sous le corps). */
  primaryCta?: { url: string; label: string };
  /** Lien secondaire discret (ex. désinscription, accès direct). */
  secondaryCta?: { url: string; label: string };
  footerNote?: string;
};

/** Coquille HTML complète d’un mail (header SPORFORMATION + ton sobre). */
export function renderEmailShell(opts: EmailShellOptions): string {
  const accent = opts.accent ?? accentPalette("red");
  const preheader = escapeHtml(opts.preheader);
  const kicker = escapeHtml(opts.kicker);
  const title = escapeHtml(opts.title);
  const intro = escapeHtml(opts.intro);
  const fallbackFooter =
    opts.locale === "en"
      ? "SPORFORMATION — internal platform · this notification was generated automatically."
      : "SPORFORMATION — plateforme interne · notification générée automatiquement, merci de ne pas répondre directement à ce mail.";
  const footerNote = escapeHtml(opts.footerNote ?? fallbackFooter);

  const ctaHtml = opts.primaryCta
    ? `<div style="text-align:center;">${renderCtaButton({
        url: opts.primaryCta.url,
        label: opts.primaryCta.label,
        color: accent.solid,
      })}</div>`
    : "";

  const secondaryHtml = opts.secondaryCta
    ? `<div style="text-align:center;">${renderSecondaryLink({
        url: opts.secondaryCta.url,
        label: opts.secondaryCta.label,
      })}</div>`
    : "";

  return `<!doctype html>
<html lang="${opts.locale === "en" ? "en" : "fr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_PALETTE.SOFT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${EMAIL_PALETTE.INK};">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL_PALETTE.SOFT_BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid ${EMAIL_PALETTE.BORDER};box-shadow:0 1px 2px rgba(15,23,42,0.04);">
          <tr>
            <td style="background:${EMAIL_PALETTE.INK};padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#FFFFFF;font-size:18px;font-weight:800;letter-spacing:1.6px;">SPORFORMATION</td>
                  <td align="right" style="color:${EMAIL_PALETTE.ORANGE};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">${kicker}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:6px;background:${accent.solid};line-height:6px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 6px 28px;">
              <div style="font-size:11px;font-weight:700;color:${accent.solid};letter-spacing:1.6px;text-transform:uppercase;margin-bottom:8px;">${kicker}</div>
              <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.25;color:${EMAIL_PALETTE.INK};font-weight:800;">${title}</h1>
              <p style="margin:0;font-size:14.5px;color:${EMAIL_PALETTE.MUTED};line-height:1.55;">${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px 28px;">${opts.bodyHtml}</td>
          </tr>
          ${
            ctaHtml || secondaryHtml
              ? `<tr><td style="padding:4px 28px 18px 28px;">${ctaHtml}${secondaryHtml}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:0 28px 26px 28px;">
              <hr style="border:none;border-top:1px solid ${EMAIL_PALETTE.BORDER};margin:0 0 14px 0;" />
              <p style="margin:0;font-size:12px;color:${EMAIL_PALETTE.MUTED};line-height:1.55;">${footerNote}</p>
            </td>
          </tr>
        </table>
        <div style="max-width:600px;margin:14px auto 0;text-align:center;font-size:11px;color:${EMAIL_PALETTE.MUTED_2};">
          © SPORFORMATION · plateforme interne établissement
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Petits libellés communs aux deux locales (CTA principal "Accéder au site"). */
export function siteCtaLabel(locale: AppLocale): string {
  return locale === "en" ? "Open SPORFORMATION" : "Accéder à SPORFORMATION";
}
