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
