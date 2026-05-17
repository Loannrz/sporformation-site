import type { InscriptionSubmissionAdminRow } from "@/lib/data/inscription-submissions-admin";
import { resolveAppOrigin } from "@/lib/email/app-origin";
import { sendTransactionalEmail } from "@/lib/email/resend-helpers";
import {
  accentPalette,
  EMAIL_PALETTE,
  escapeHtml,
  renderDescription,
  renderEmailShell,
} from "@/lib/email/shell";
import { buildTemplateFieldLabelMap } from "@/lib/inscription-submission-progress";

function portalEntryUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_INSCRIPTION_ENTRY_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${resolveAppOrigin()}/fr`;
}

/** E-mail saisi dans le formulaire (identification), sinon compte portail. */
export function resolveInscriptionCandidateNotifyEmail(
  row: InscriptionSubmissionAdminRow,
): string | null {
  const fromForm = row.candidate_email?.trim();
  if (fromForm && fromForm.includes("@")) return fromForm;
  const portal = row.portal_email?.trim();
  if (portal && portal.includes("@")) return portal;
  return null;
}

function dossierLabel(row: InscriptionSubmissionAdminRow): string {
  const title = row.template_title?.trim();
  const formation = row.formation_slug?.trim();
  const ville = row.ville_slug?.trim();
  const bits = [title, formation, ville].filter(Boolean);
  return bits.length ? bits.join(" · ") : "votre dossier de candidature";
}

function candidateGreetingName(row: InscriptionSubmissionAdminRow): string {
  const fn = row.candidate_prenom?.trim();
  const ln = row.candidate_nom?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  if (ln) return ln;
  return "";
}

function modificationsDetailHtml(row: InscriptionSubmissionAdminRow): string {
  const parts: string[] = [];
  const notice = row.candidate_revision_notice?.trim();
  if (notice) {
    parts.push(
      renderDescription({
        label: "Message de l’établissement",
        body: notice,
        accent: accentPalette("amber"),
      }),
    );
  }

  const labelMap = buildTemplateFieldLabelMap(row.template_definition);
  const entries = Object.entries(row.admin_field_flags)
    .map(([id, entry]) => ({
      id: id.trim(),
      message:
        entry && typeof entry.message === "string" ? entry.message.trim() : "",
    }))
    .filter((e) => e.id)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (entries.length > 0) {
    const items = entries
      .map(({ id, message }) => {
        const lab = labelMap.get(id) ?? id;
        const line = message ? `${lab} — ${message}` : lab;
        return `<li style="margin:0 0 6px 0;font-size:13px;color:${EMAIL_PALETTE.INK};line-height:1.45;">${escapeHtml(line)}</li>`;
      })
      .join("");
    parts.push(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#FFFFFF;border:1px solid ${EMAIL_PALETTE.BORDER};border-radius:10px;padding:16px;">
          <div style="font-size:12px;font-weight:700;color:${EMAIL_PALETTE.INK};letter-spacing:0.3px;margin-bottom:10px;">Questions à reprendre ou à compléter</div>
          <ul style="margin:0;padding-left:18px;">${items}</ul>
        </td>
      </tr>
    </table>`);
  }

  return parts.join("");
}

async function sendFr(opts: {
  row: InscriptionSubmissionAdminRow;
  subject: string;
  kicker: string;
  title: string;
  intro: string;
  bodyHtml: string;
  accentKey: string;
  preheader: string;
}): Promise<void> {
  const to = resolveInscriptionCandidateNotifyEmail(opts.row);
  if (!to) {
    console.info(
      "[sporformation/email/inscription] Pas d’adresse candidat — pas d’envoi",
      opts.row.id,
    );
    return;
  }

  const html = renderEmailShell({
    locale: "fr",
    preheader: opts.preheader,
    kicker: opts.kicker,
    title: opts.title,
    intro: opts.intro,
    bodyHtml: opts.bodyHtml,
    accent: accentPalette(opts.accentKey),
    primaryCta: {
      url: portalEntryUrl(),
      label: "Ouvrir le portail candidature",
    },
    footerNote:
      "SPORFORMATION — message automatique concernant votre dossier. En cas de question, contactez directement l’établissement.",
  });

  try {
    await sendTransactionalEmail({
      to,
      subject: opts.subject,
      html,
    });
  } catch (err) {
    console.error("[sporformation/email/inscription] Échec envoi:", err);
  }
}

export async function notifyInscriptionSubmissionAccepted(
  row: InscriptionSubmissionAdminRow,
): Promise<void> {
  const who = candidateGreetingName(row);
  const dl = dossierLabel(row);
  const intro = who
    ? `Bonjour ${who}, votre candidature « ${dl} » a été acceptée par l’établissement.`
    : `Votre candidature « ${dl} » a été acceptée par l’établissement.`;

  await sendFr({
    row,
    subject: "Candidature acceptée — SPORFORMATION",
    kicker: "Inscription",
    title: "Votre candidature est validée",
    intro,
    bodyHtml: "",
    accentKey: "emerald",
    preheader: "Votre candidature a été acceptée.",
  });
}

export async function notifyInscriptionSubmissionRejected(
  row: InscriptionSubmissionAdminRow,
): Promise<void> {
  const who = candidateGreetingName(row);
  const note = row.reviewer_note?.trim();
  const dl = dossierLabel(row);
  const intro = who
    ? `Bonjour ${who}, concernant « ${dl} », l’établissement ne donne pas suite favorable à cette candidature.`
    : `Concernant « ${dl} », l’établissement ne donne pas suite favorable à cette candidature.`;

  const noteHtml = note
    ? renderDescription({
        label: "Précisions éventuelles",
        body: note,
        accent: accentPalette("rose"),
      })
    : "";

  await sendFr({
    row,
    subject: "Décision sur votre candidature — SPORFORMATION",
    kicker: "Inscription",
    title: "Candidature non retenue",
    intro,
    bodyHtml: noteHtml,
    accentKey: "rose",
    preheader: "Décision sur votre candidature.",
  });
}

export async function notifyInscriptionSubmissionModificationsRequested(
  row: InscriptionSubmissionAdminRow,
): Promise<void> {
  const who = candidateGreetingName(row);
  const dl = dossierLabel(row);
  const intro = who
    ? `Bonjour ${who}, l’établissement demande des modifications sur « ${dl} » avant de poursuivre l’instruction. Merci de vous reconnecter au portail pour mettre à jour votre dossier.`
    : `L’établissement demande des modifications sur « ${dl} ». Reconnectez-vous au portail pour mettre à jour votre dossier.`;

  const bodyHtml = modificationsDetailHtml(row);

  await sendFr({
    row,
    subject: "Modifications demandées sur votre candidature — SPORFORMATION",
    kicker: "Inscription",
    title: "Votre dossier doit être complété ou corrigé",
    intro,
    bodyHtml,
    accentKey: "amber",
    preheader: "Des modifications sont demandées sur votre candidature.",
  });
}
