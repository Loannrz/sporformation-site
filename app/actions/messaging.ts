"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { hasPermission } from "@/lib/permissions";
import {
  getMaxMessageSentAt,
  userParticipatesInConversation,
} from "@/lib/data/messaging";
import { sanitizeStorageObjectFileName } from "@/lib/storage-filename";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";
import { notifyConversationParticipantsNewMessage } from "@/lib/email/notify-message";

async function db() {
  const admin = createAdminSupabase();
  return admin ?? (await createServerSupabase());
}

async function requireMessagingUser() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "SEND_MESSAGES")) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const STORAGE_BUCKET = "message_attachments";

export async function createDirectConversationAction(
  locale: AppLocale,
  otherProfileId: string,
): Promise<
  { ok: true; conversationId: string } | { ok: false; error: string }
> {
  const gate = await requireMessagingUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!UUID_RE.test(otherProfileId) || otherProfileId === gate.user.id) {
    return { ok: false, error: "INVALID_PARTICIPANT" };
  }

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", gate.user.id);

  const { data: theirs } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", otherProfileId);

  const mySet = new Set(
    (mine as { conversation_id: string }[] | null)?.map((m) => m.conversation_id) ??
      [],
  );
  const candidates =
    (theirs as { conversation_id: string }[] | null)?.filter((t) =>
      mySet.has(t.conversation_id),
    ) ?? [];

  let foundId: string | null = null;
  for (const { conversation_id: cid } of candidates) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id,is_group")
      .eq("id", cid)
      .maybeSingle();
    if (conv && !(conv as { is_group: boolean }).is_group) {
      const { data: pcount } = await supabase
        .from("conversation_participants")
        .select("profile_id")
        .eq("conversation_id", cid);
      const n = (pcount as { profile_id: string }[] | null)?.length ?? 0;
      if (n === 2) {
        foundId = cid;
        break;
      }
    }
  }

  if (foundId) {
    revalidatePath(`/${locale}/messagerie`);
    return { ok: true, conversationId: foundId };
  }

  const { data: insConv, error: cErr } = await supabase
    .from("conversations")
    .insert({
      is_group: false,
      name: null,
      created_by: gate.user.id,
    })
    .select("id")
    .single();

  if (cErr || !insConv?.id) {
    return { ok: false, error: cErr?.message ?? "CREATE_CONV_FAILED" };
  }

  const cid = insConv.id as string;
  const { error: pErr } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: cid, profile_id: gate.user.id },
      { conversation_id: cid, profile_id: otherProfileId },
    ]);

  if (pErr) {
    return { ok: false, error: pErr.message };
  }

  await logActivity({
    ...actorFromSession(gate.user),
    action: "MESSAGE_CONVERSATION_CREATED_DIRECT",
    entityType: "conversation",
    entityId: cid,
    meta: { other_profile_id: otherProfileId },
  });

  revalidatePath(`/${locale}/messagerie`);
  return { ok: true, conversationId: cid };
}

export async function createGroupConversationAction(
  locale: AppLocale,
  input: { name: string; memberProfileIds: string[] },
): Promise<
  { ok: true; conversationId: string } | { ok: false; error: string }
> {
  const gate = await requireMessagingUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  const unique = [
    ...new Set(input.memberProfileIds.filter((id) => UUID_RE.test(id))),
  ];
  if (unique.includes(gate.user.id)) {
    unique.splice(unique.indexOf(gate.user.id), 1);
  }
  if (unique.length < 2) {
    return { ok: false, error: "GROUP_MIN_TWO_OTHERS" };
  }

  const name = input.name.trim().slice(0, 120);
  if (!name) {
    return { ok: false, error: "GROUP_NAME_REQUIRED" };
  }

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { data: insConv, error: cErr } = await supabase
    .from("conversations")
    .insert({
      is_group: true,
      name,
      created_by: gate.user.id,
      group_admin_profile_id: gate.user.id,
    })
    .select("id")
    .single();

  if (cErr || !insConv?.id) {
    return { ok: false, error: cErr?.message ?? "CREATE_CONV_FAILED" };
  }

  const cid = insConv.id as string;
  const participantRows = [gate.user.id, ...unique].map((profile_id) => ({
    conversation_id: cid,
    profile_id,
  }));

  const { error: pErr } = await supabase
    .from("conversation_participants")
    .insert(participantRows);

  if (pErr) {
    return { ok: false, error: pErr.message };
  }

  await logActivity({
    ...actorFromSession(gate.user),
    action: "MESSAGE_CONVERSATION_CREATED_GROUP",
    entityType: "conversation",
    entityId: cid,
    entityLabel: name,
    meta: {
      member_count: participantRows.length,
      member_profile_ids: unique,
    },
  });

  revalidatePath(`/${locale}/messagerie`);
  return { ok: true, conversationId: cid };
}

export async function sendMessageAction(
  locale: AppLocale,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireMessagingUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  const conversationIdRaw = formData.get("conversationId");
  const conversationId =
    typeof conversationIdRaw === "string" ? conversationIdRaw.trim() : "";
  if (!UUID_RE.test(conversationId)) {
    return { ok: false, error: "INVALID_CONVERSATION" };
  }

  const bodyRaw = formData.get("body");
  const body =
    typeof bodyRaw === "string" ? bodyRaw.trim().slice(0, 8000) : "";

  const fileEntry = formData.get("file");
  const file =
    fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  if (!body && !file) {
    return { ok: false, error: "EMPTY_MESSAGE" };
  }

  const okPart = await userParticipatesInConversation(
    gate.user.id,
    conversationId,
  );
  if (!okPart) return { ok: false, error: "NOT_PARTICIPANT" };

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  if (file) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "FILE_TOO_LARGE" };
    }
    const admin = createAdminSupabase();
    if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

    const insertRes = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: gate.user.id,
        body,
      })
      .select("id")
      .single();

    if (insertRes.error || !(insertRes.data as { id?: string } | null)?.id) {
      return {
        ok: false,
        error:
          insertRes.error?.message?.slice(0, 240) ??
          "ATTACH_UPLOAD_FAILED",
      };
    }

    const messageId = (insertRes.data as { id: string }).id;
    const safeName = sanitizeStorageObjectFileName(
      file.name,
      "piece-jointe",
    );
    const objectPath = `${conversationId}/${messageId}/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, buffer, {
        upsert: false,
        contentType: file.type ? file.type : "application/octet-stream",
      });

    if (upErr) {
      await admin.from("messages").delete().eq("id", messageId);
      return {
        ok: false,
        error: "ATTACH_UPLOAD_FAILED",
      };
    }

    const { error: patchErr } = await supabase
      .from("messages")
      .update({
        attachment_path: objectPath,
        attachment_filename: safeName,
        attachment_mime: file.type || null,
        attachment_size_bytes: file.size,
      })
      .eq("id", messageId);

    if (patchErr) {
      await admin.storage.from(STORAGE_BUCKET).remove([objectPath]);
      await admin.from("messages").delete().eq("id", messageId);
      return { ok: false, error: patchErr.message };
    }
  } else {
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: gate.user.id,
      body,
    });

    if (error) return { ok: false, error: error.message };
  }

  const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
  await logActivity({
    ...actorFromSession(gate.user),
    action: "MESSAGE_SENT",
    entityType: "conversation",
    entityId: conversationId,
    meta: {
      preview,
      body_length: body.length,
      has_attachment: Boolean(file),
      attachment_filename: file?.name ?? null,
      attachment_size_bytes: file?.size ?? null,
    },
  });

  const adminForEmail = createAdminSupabase();
  if (adminForEmail) {
    try {
      await notifyConversationParticipantsNewMessage({
        admin: adminForEmail,
        conversationId,
        senderAuthUserId: gate.user.id,
        senderDisplayName: `${gate.user.firstName} ${gate.user.lastName}`,
        locale,
        bodyPreview: preview,
        hadAttachment: Boolean(file),
      });
    } catch (e) {
      console.error("[messagerie/email]", e);
    }
  }

  revalidatePath(`/${locale}/messagerie`);
  revalidatePath(`/${locale}/messagerie/${conversationId}`);
  return { ok: true };
}

export async function markConversationReadAction(
  locale: AppLocale,
  conversationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireMessagingUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!UUID_RE.test(conversationId)) {
    return { ok: false, error: "INVALID_CONVERSATION" };
  }

  const okPart = await userParticipatesInConversation(
    gate.user.id,
    conversationId,
  );
  if (!okPart) return { ok: false, error: "NOT_PARTICIPANT" };

  const maxAt = await getMaxMessageSentAt(conversationId);
  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: maxAt ?? new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", gate.user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${locale}/messagerie`);
  revalidatePath(`/${locale}/messagerie/${conversationId}`);
  return { ok: true };
}
