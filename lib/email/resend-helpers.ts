import { Resend } from "resend";

export function transactionalFrom(): string {
  return process.env.EMAIL_FROM ?? "SPORFORMATION <onboarding@resend.dev>";
}

function normalizeRecipients(
  to: string | string[],
): string[] {
  const list = Array.isArray(to) ? to : [to];
  return [
    ...new Set(
      list
        .map((e) => e.trim())
        .filter((e) => e.includes("@")),
    ),
  ];
}

/** Envoi transactional Resend ; sans clé API, log simulateur comme le reste du projet. */
export async function sendTransactionalEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: Buffer | string;
    content_type?: string;
  }[];
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const recipients = normalizeRecipients(opts.to);
  if (recipients.length === 0) return;

  if (!key) {
    console.info(
      "[sporformation/email] RESEND_API_KEY absent — email simulé",
      opts.subject,
      recipients,
    );
    return;
  }

  const resend = new Resend(key);
  await resend.emails.send({
    from: transactionalFrom(),
    to: recipients,
    subject: opts.subject,
    html: opts.html,
    ...(opts.attachments && opts.attachments.length > 0
      ? { attachments: opts.attachments }
      : {}),
  });
}
