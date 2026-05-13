import { Resend } from "resend";

export async function emailSanctionPdfToDirector(opts: {
  pdfBuffer: Buffer;
  filename: string;
  studentName: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.DIRECTOR_EMAIL ?? "direction@sporformation.fr";
  if (!key) {
    console.info(
      "[sporformation/email] RESEND_API_KEY absent — envoi PDF sanction simulé pour",
      to,
    );
    return;
  }

  const resend = new Resend(key);
  const from = process.env.EMAIL_FROM ?? "SPORFORMATION <onboarding@resend.dev>";

  await resend.emails.send({
    from,
    to,
    subject: `[SPORFORMATION] Sanction — ${opts.studentName}`,
    html: `<p>Document disciplinaire généré automatiquement pour <strong>${opts.studentName}</strong>.</p>`,
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
}) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.DIRECTOR_EMAIL ?? "direction@sporformation.fr";
  const maxNames = 40;
  const listed = opts.studentNames.slice(0, maxNames);
  const rest =
    opts.studentNames.length > maxNames
      ? `<p>… et ${opts.studentNames.length - maxNames} autre(s) élève(s).</p>`
      : "";
  const listHtml = `<ul>${listed.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`;

  if (!key) {
    console.info(
      "[sporformation/email] RESEND_API_KEY absent — signalement classe simulé pour",
      to,
      opts.className,
      opts.count,
    );
    return;
  }

  const resend = new Resend(key);
  const from = process.env.EMAIL_FROM ?? "SPORFORMATION <onboarding@resend.dev>";

  await resend.emails.send({
    from,
    to,
    subject: `[SPORFORMATION] Signalement groupe — ${opts.className} (${opts.count} élève(s))`,
    html: `<p><strong>${escapeHtml(opts.className)}</strong> — ${opts.count} enregistrement(s) disciplinaire(s).</p>
<p><strong>Type :</strong> ${escapeHtml(opts.typeLabel)}</p>
<p><strong>Détail :</strong></p>
<p>${escapeHtml(opts.description)}</p>
<p><strong>Élèves concernés :</strong></p>
${listHtml}
${rest}`,
  });
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
