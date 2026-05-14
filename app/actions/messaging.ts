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

  revalidatePath(`/${locale}/messagerie`);
  return { ok: true, conversationId: cid };
}

export async function sendMessageAction(
  locale: AppLocale,
  input: { conversationId: string; body: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireMessagingUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!UUID_RE.test(input.conversationId)) {
    return { ok: false, error: "INVALID_CONVERSATION" };
  }

  const body = input.body.trim().slice(0, 8000);
  if (!body) {
    return { ok: false, error: "EMPTY_MESSAGE" };
  }

  const okPart = await userParticipatesInConversation(
    gate.user.id,
    input.conversationId,
  );
  if (!okPart) return { ok: false, error: "NOT_PARTICIPANT" };

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    sender_id: gate.user.id,
    body,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${locale}/messagerie`);
  revalidatePath(`/${locale}/messagerie/${input.conversationId}`);
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
