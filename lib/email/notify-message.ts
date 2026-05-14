import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppOrigin } from "@/lib/email/app-origin";
import { resolveEmailForAuthUserId } from "@/lib/email/resolve-auth-email";
import { sendTransactionalEmail } from "@/lib/email/resend-helpers";
import type { AppLocale } from "@/i18n/routing";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function notifyConversationParticipantsNewMessage(opts: {
  admin: SupabaseClient;
  conversationId: string;
  senderAuthUserId: string;
  senderDisplayName: string;
  locale: AppLocale;
  bodyPreview: string;
  hadAttachment: boolean;
}): Promise<void> {
  const { data: parts } = await opts.admin
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", opts.conversationId);

  const recipientIds =
    (parts as { profile_id: string }[] | null)?.map((p) => p.profile_id) ??
    [];

  const targetIds = recipientIds.filter((id) => id && id !== opts.senderAuthUserId);
  if (targetIds.length === 0) return;

  const origin = resolveAppOrigin();
  const pathLocale = opts.locale === "en" ? "en" : "fr";
  const replyUrl = `${origin}/${pathLocale}/messagerie/${opts.conversationId}`;

  let preview =
    opts.bodyPreview.trim().length > 0
      ? escapeHtml(opts.bodyPreview.trim())
      : null;
  if (!preview && opts.hadAttachment) {
    preview =
      opts.locale === "en"
        ? "<em>(Attachment)</em>"
        : "<em>(Pièce jointe)</em>";
  }
  if (!preview) {
    preview =
      opts.locale === "en" ? "<em>(Empty message)</em>" : "<em>(Message vide)</em>";
  }

  const sender = escapeHtml(opts.senderDisplayName.trim() || "—");

  await Promise.all(
    targetIds.map(async (recipientId) => {
      const email = await resolveEmailForAuthUserId(opts.admin, recipientId);
      if (!email) return;

      const subject =
        opts.locale === "en"
          ? `[SPORFORMATION] New message from ${opts.senderDisplayName.trim() || "someone"}`
          : `[SPORFORMATION] Nouveau message de ${opts.senderDisplayName.trim() || "un collège"}`;

      const htmlFr = `<p>Vous avez reçu un message sur SPORFORMATION.</p>
<p><strong>De :</strong> ${sender}</p>
<p><strong>Aperçu :</strong> ${preview}</p>
<p><a href="${replyUrl}">Ouvrir la conversation et répondre</a></p>`;

      const htmlEn = `<p>You have a new message on SPORFORMATION.</p>
<p><strong>From:</strong> ${sender}</p>
<p><strong>Preview:</strong> ${preview}</p>
<p><a href="${replyUrl}">Open conversation and reply</a></p>`;

      await sendTransactionalEmail({
        to: email,
        subject,
        html: opts.locale === "en" ? htmlEn : htmlFr,
      });
    }),
  );
}
