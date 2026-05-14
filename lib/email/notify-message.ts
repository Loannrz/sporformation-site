import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppOrigin } from "@/lib/email/app-origin";
import { resolveEmailForAuthUserId } from "@/lib/email/resolve-auth-email";
import { sendTransactionalEmail } from "@/lib/email/resend-helpers";
import {
  accentPalette,
  escapeHtml,
  EMAIL_PALETTE,
  renderEmailShell,
  renderQuoteBlock,
  siteCtaLabel,
} from "@/lib/email/shell";
import type { AppLocale } from "@/i18n/routing";

const PREVIEW_MAX = 360;

function truncatePreview(s: string): string {
  if (s.length <= PREVIEW_MAX) return s;
  return s.slice(0, PREVIEW_MAX).trimEnd() + "…";
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
    (parts as { profile_id: string }[] | null)?.map((p) => p.profile_id) ?? [];

  const targetIds = recipientIds.filter(
    (id) => id && id !== opts.senderAuthUserId,
  );
  if (targetIds.length === 0) return;

  const origin = resolveAppOrigin();
  const pathLocale = opts.locale === "en" ? "en" : "fr";
  const replyUrl = `${origin}/${pathLocale}/messagerie/${opts.conversationId}`;
  const inboxUrl = `${origin}/${pathLocale}/messagerie`;
  const accent = accentPalette("red");

  const trimmedPreview = truncatePreview(opts.bodyPreview.trim());
  const senderName = opts.senderDisplayName.trim() || "—";

  const previewHtmlFr = trimmedPreview.length > 0
    ? escapeHtml(trimmedPreview)
    : opts.hadAttachment
      ? `<em style="color:${EMAIL_PALETTE.MUTED};">(Pièce jointe envoyée)</em>`
      : `<em style="color:${EMAIL_PALETTE.MUTED};">(Message vide)</em>`;

  const previewHtmlEn = trimmedPreview.length > 0
    ? escapeHtml(trimmedPreview)
    : opts.hadAttachment
      ? `<em style="color:${EMAIL_PALETTE.MUTED};">(Attachment shared)</em>`
      : `<em style="color:${EMAIL_PALETTE.MUTED};">(Empty message)</em>`;

  await Promise.all(
    targetIds.map(async (recipientId) => {
      const email = await resolveEmailForAuthUserId(opts.admin, recipientId);
      if (!email) return;

      const subject =
        opts.locale === "en"
          ? `[SPORFORMATION] New message from ${senderName}`
          : `[SPORFORMATION] Nouveau message de ${senderName}`;

      const quote = renderQuoteBlock({
        authorLabel: opts.locale === "en" ? "From" : "De",
        authorName: senderName,
        bodyHtml: opts.locale === "en" ? previewHtmlEn : previewHtmlFr,
        accent,
      });

      const intro =
        opts.locale === "en"
          ? `${senderName} just sent you a new message on SPORFORMATION.`
          : `${senderName} vient de vous envoyer un nouveau message sur SPORFORMATION.`;

      const title =
        opts.locale === "en"
          ? "New message"
          : "Nouveau message";

      const kicker =
        opts.locale === "en"
          ? "Messaging"
          : "Messagerie";

      const preheader =
        opts.locale === "en"
          ? `${senderName}: ${trimmedPreview || (opts.hadAttachment ? "attachment shared" : "empty message")}`
          : `${senderName} : ${trimmedPreview || (opts.hadAttachment ? "pièce jointe partagée" : "message vide")}`;

      const ctaLabel =
        opts.locale === "en"
          ? "Open the conversation"
          : "Ouvrir la conversation";

      const secondaryLabel =
        opts.locale === "en"
          ? "Back to inbox"
          : "Revenir à la boîte de réception";

      const html = renderEmailShell({
        locale: opts.locale,
        preheader,
        kicker,
        title,
        intro,
        bodyHtml: quote,
        accent,
        primaryCta: { url: replyUrl, label: ctaLabel },
        secondaryCta: { url: inboxUrl, label: secondaryLabel },
        footerNote:
          opts.locale === "en"
            ? `SPORFORMATION — please reply from the platform · ${siteCtaLabel(opts.locale)}.`
            : `SPORFORMATION — merci de répondre depuis la plateforme · ${siteCtaLabel(opts.locale)}.`,
      });

      await sendTransactionalEmail({
        to: email,
        subject,
        html,
      });
    }),
  );
}
