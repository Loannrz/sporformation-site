import { resolveAppOrigin } from "@/lib/email/app-origin";
import { sendTransactionalEmail } from "@/lib/email/resend-helpers";
import {
  accentPalette,
  renderDescription,
  renderEmailShell,
  renderInfoCard,
  renderStudentList,
  renderTypePill,
  siteCtaLabel,
  EMAIL_PALETTE,
} from "@/lib/email/shell";

function directorRecipients(extraEmail?: string | null): string[] {
  const directorEmail =
    process.env.DIRECTOR_EMAIL ?? "direction@sporformation.fr";
  const list = [directorEmail];
  const extra = extraEmail?.trim() ?? "";
  if (extra.includes("@") && extra !== directorEmail) {
    list.push(extra);
  }
  return list;
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
  const accent = accentPalette("red");
  const origin = resolveAppOrigin();

  const to = directorRecipients(opts.headTeacherEmail);

  const infoRows: { label: string; value: string }[] = [
    { label: "Étudiant·e", value: opts.studentName },
    { label: "Classe", value: opts.classNameLabel ?? "—" },
    { label: "Horodatage", value: opts.dateLabel ?? "—" },
    { label: "Référent pédagogique", value: opts.authorName ?? "—" },
  ];

  const bodyHtml = `
    ${renderInfoCard(infoRows)}
    ${opts.sanctionTypeLabel ? renderTypePill({ label: "Motif de la sanction", value: opts.sanctionTypeLabel, accent }) : ""}
    ${opts.description ? renderDescription({ label: "Synthèse factuelle", body: opts.description, accent }) : ""}
    <p style="margin:8px 0 0 0;font-size:13px;color:${EMAIL_PALETTE.MUTED};line-height:1.5;">
      L’avis disciplinaire officiel est joint à ce message au format PDF.
    </p>`;

  const html = renderEmailShell({
    locale: "fr",
    preheader: `Sanction enregistrée pour ${opts.studentName}.`,
    kicker: "Acte disciplinaire",
    title: `Nouvelle sanction — ${opts.studentName}`,
    intro:
      "Une nouvelle sanction vient d’être enregistrée sur la plateforme SPORFORMATION. Vous trouverez ci-dessous le récapitulatif et le PDF officiel en pièce jointe.",
    bodyHtml,
    accent,
    primaryCta: {
      url: `${origin}/fr/sanctions`,
      label: "Ouvrir le tableau des sanctions",
    },
    secondaryCta: {
      url: `${origin}/fr/dashboard`,
      label: siteCtaLabel("fr"),
    },
    footerNote:
      "SPORFORMATION — document interne · reproduction restreinte à la procédure administrative.",
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
  const accent = accentPalette("red");
  const origin = resolveAppOrigin();

  const to = directorRecipients(opts.headTeacherEmail);

  const maxNames = 40;
  const listed = opts.studentNames.slice(0, maxNames);
  const overflow =
    opts.studentNames.length > maxNames
      ? `<p style="margin:8px 0 0 0;font-size:12px;color:${EMAIL_PALETTE.MUTED};">… et ${opts.studentNames.length - maxNames} autre(s) élève(s).</p>`
      : "";

  const infoRows: { label: string; value: string }[] = [
    { label: "Classe", value: opts.className },
    { label: "Effectif concerné", value: `${opts.count} élève(s)` },
    { label: "Horodatage", value: opts.dateLabel ?? "—" },
    { label: "Référent pédagogique", value: opts.authorName ?? "—" },
  ];

  const bodyHtml = `
    ${renderInfoCard(infoRows)}
    ${renderTypePill({ label: "Motif appliqué à la classe", value: opts.typeLabel, accent })}
    ${renderDescription({ label: "Synthèse factuelle", body: opts.description, accent })}
    ${renderStudentList({ label: "Élèves concernés", names: listed })}
    ${overflow}`;

  const html = renderEmailShell({
    locale: "fr",
    preheader: `Signalement groupe — ${opts.className} (${opts.count} élève(s)).`,
    kicker: "Signalement groupé",
    title: `Signalement classe — ${opts.className}`,
    intro:
      "Un signalement disciplinaire a été appliqué à l’ensemble d’une classe sur la plateforme SPORFORMATION. Retrouvez le détail ci-dessous.",
    bodyHtml,
    accent,
    primaryCta: {
      url: `${origin}/fr/sanctions`,
      label: "Ouvrir le tableau des sanctions",
    },
    secondaryCta: {
      url: `${origin}/fr/dashboard`,
      label: siteCtaLabel("fr"),
    },
    footerNote:
      "SPORFORMATION — document interne · reproduction restreinte à la procédure administrative.",
  });

  await sendTransactionalEmail({
    to,
    subject: `[SPORFORMATION] Signalement groupe — ${opts.className} (${opts.count} élève(s))`,
    html,
  });
}
