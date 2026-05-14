import { sendTransactionalEmail } from "@/lib/email/resend-helpers";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const BRAND_RED = "#E63946";
const BRAND_ORANGE = "#F4A261";
const INK = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const SOFT_BG = "#F8FAFC";

/**
 * Coquille HTML responsive pour les mails transactionnels — tables imbriquées
 * (compatibilité clients mail) + palette SPORFORMATION (rouge / orange / encre).
 */
function renderShell(opts: {
  preheader: string;
  kicker: string;
  title: string;
  intro: string;
  bodyHtml: string;
  footerNote?: string;
}) {
  const preheader = escapeHtml(opts.preheader);
  const kicker = escapeHtml(opts.kicker);
  const title = escapeHtml(opts.title);
  const intro = escapeHtml(opts.intro);
  const footerNote = escapeHtml(
    opts.footerNote ??
      "SPORFORMATION — document interne · reproduction restreinte à la procédure administrative.",
  );

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${SOFT_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SOFT_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="background:${INK};padding:24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:1.4px;">SPORFORMATION</td>
                  <td align="right" style="color:${BRAND_ORANGE};font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">${kicker}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:6px;background:${BRAND_RED};line-height:6px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <div style="font-size:11px;font-weight:700;color:${BRAND_RED};letter-spacing:1.6px;text-transform:uppercase;margin-bottom:6px;">${kicker}</div>
              <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.25;color:${INK};">${title}</h1>
              <p style="margin:0;font-size:14px;color:${MUTED};line-height:1.5;">${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px 28px;">${opts.bodyHtml}</td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;">
              <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.5;">${footerNote}</p>
            </td>
          </tr>
        </table>
        <div style="max-width:600px;margin:14px auto 0;text-align:center;font-size:11px;color:${MUTED};">
          © SPORFORMATION · plateforme interne
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderInfoCard(rows: { label: string; value: string }[]) {
  const tds = rows
    .map(
      ({ label, value }) => `
            <td valign="top" style="width:50%;padding:14px 14px;">
              <div style="font-size:10px;font-weight:700;color:${MUTED};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(label)}</div>
              <div style="font-size:14px;font-weight:700;color:${INK};">${escapeHtml(value || "—")}</div>
            </td>`,
    );

  const rowsHtml: string[] = [];
  for (let i = 0; i < tds.length; i += 2) {
    const right = tds[i + 1] ?? `<td style="width:50%;"></td>`;
    rowsHtml.push(`<tr>${tds[i]}${right}</tr>`);
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDER};border-radius:8px;background:#FFFFFF;margin-bottom:14px;">
      ${rowsHtml.join("")}
    </table>`;
}

function renderTypePill(label: string, value: string) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#FFF1F2;border-left:4px solid ${BRAND_RED};padding:14px 16px;border-radius:4px;">
          <div style="font-size:10px;font-weight:700;color:${BRAND_RED};letter-spacing:1.4px;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(label)}</div>
          <div style="font-size:17px;font-weight:700;color:${INK};">${escapeHtml(value)}</div>
        </td>
      </tr>
    </table>`;
}

function renderDescription(label: string, body: string) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:${SOFT_BG};border:1px solid ${BORDER};border-radius:8px;padding:16px;">
          <div style="display:flex;align-items:center;margin-bottom:6px;">
            <span style="display:inline-block;width:4px;height:14px;background:${BRAND_RED};margin-right:8px;vertical-align:middle;"></span>
            <span style="font-size:12px;font-weight:700;color:${INK};letter-spacing:0.3px;vertical-align:middle;">${escapeHtml(label)}</span>
          </div>
          <div style="font-size:13px;color:${INK};line-height:1.55;white-space:pre-wrap;">${escapeHtml(body)}</div>
        </td>
      </tr>
    </table>`;
}

function renderStudentList(label: string, names: string[]) {
  const items = names
    .map(
      (n) =>
        `<li style="margin:0 0 4px 0;font-size:13px;color:${INK};">${escapeHtml(n)}</li>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#FFFFFF;border:1px solid ${BORDER};border-radius:8px;padding:16px;">
          <div style="font-size:12px;font-weight:700;color:${INK};letter-spacing:0.3px;margin-bottom:8px;">${escapeHtml(label)}</div>
          <ul style="margin:0;padding-left:18px;">${items}</ul>
        </td>
      </tr>
    </table>`;
}

export async function emailSanctionPdfToDirector(opts: {
  pdfBuffer: Buffer;
  filename: string;
  studentName: string;
  /** Professeur principal de la classe (même destinataires que direction + PP). */
  headTeacherEmail?: string | null;
  classNameLabel?: string | null;
  sanctionTypeLabel?: string | null;
  dateLabel?: string | null;
  description?: string | null;
  authorName?: string | null;
}) {
  const directorEmail =
    process.env.DIRECTOR_EMAIL ?? "direction@sporformation.fr";
  const extra = opts.headTeacherEmail?.trim() ?? "";
  const to = [directorEmail];
  if (extra.includes("@") && extra !== directorEmail) {
    to.push(extra);
  }

  const infoRows: { label: string; value: string }[] = [
    { label: "Étudiant·e", value: opts.studentName },
    { label: "Classe", value: opts.classNameLabel ?? "—" },
    { label: "Horodatage", value: opts.dateLabel ?? "—" },
    { label: "Référent pédagogique", value: opts.authorName ?? "—" },
  ];

  const bodyHtml = `
    ${renderInfoCard(infoRows)}
    ${opts.sanctionTypeLabel ? renderTypePill("Motif de la sanction", opts.sanctionTypeLabel) : ""}
    ${opts.description ? renderDescription("Synthèse factuelle", opts.description) : ""}
    <p style="margin:10px 0 0 0;font-size:13px;color:${MUTED};line-height:1.5;">
      L’avis disciplinaire officiel est joint à ce message au format PDF.
    </p>`;

  const html = renderShell({
    preheader: `Sanction enregistrée pour ${opts.studentName}.`,
    kicker: "Acte disciplinaire",
    title: `Nouvelle sanction — ${opts.studentName}`,
    intro:
      "Une nouvelle sanction vient d’être enregistrée sur la plateforme SPORFORMATION. Vous trouverez ci-dessous le récapitulatif et le PDF officiel en pièce jointe.",
    bodyHtml,
  });

  await sendTransactionalEmail({
    to,
    subject: `[SPORFORMATION] Sanction — ${opts.studentName}`,
    html,
    attachments: [
      {
        filename: opts.filename,
        content: opts.pdfBuffer,
      },
    ],
  });
}

export async function emailDisciplineClassBatchToDirector(opts: {
  className: string;
  count: number;
  typeLabel: string;
  description: string;
  studentNames: string[];
  headTeacherEmail?: string | null;
  authorName?: string | null;
  dateLabel?: string | null;
}) {
  const directorEmail =
    process.env.DIRECTOR_EMAIL ?? "direction@sporformation.fr";
  const extra = opts.headTeacherEmail?.trim() ?? "";
  const to = [directorEmail];
  if (extra.includes("@") && extra !== directorEmail) {
    to.push(extra);
  }

  const maxNames = 40;
  const listed = opts.studentNames.slice(0, maxNames);
  const overflow =
    opts.studentNames.length > maxNames
      ? `<p style="margin:8px 0 0 0;font-size:12px;color:${MUTED};">… et ${opts.studentNames.length - maxNames} autre(s) élève(s).</p>`
      : "";

  const infoRows: { label: string; value: string }[] = [
    { label: "Classe", value: opts.className },
    { label: "Effectif concerné", value: `${opts.count} élève(s)` },
    { label: "Horodatage", value: opts.dateLabel ?? "—" },
    { label: "Référent pédagogique", value: opts.authorName ?? "—" },
  ];

  const bodyHtml = `
    ${renderInfoCard(infoRows)}
    ${renderTypePill("Motif appliqué à la classe", opts.typeLabel)}
    ${renderDescription("Synthèse factuelle", opts.description)}
    ${renderStudentList("Élèves concernés", listed)}
    ${overflow}`;

  const html = renderShell({
    preheader: `Signalement groupe — ${opts.className} (${opts.count} élève(s)).`,
    kicker: "Signalement groupé",
    title: `Signalement classe — ${opts.className}`,
    intro:
      "Un signalement disciplinaire a été appliqué à l’ensemble d’une classe sur la plateforme SPORFORMATION. Retrouvez le détail ci-dessous.",
    bodyHtml,
  });

  await sendTransactionalEmail({
    to,
    subject: `[SPORFORMATION] Signalement groupe — ${opts.className} (${opts.count} élève(s))`,
    html,
  });
}
