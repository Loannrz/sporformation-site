"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { hasPermission } from "@/lib/permissions";
import type { MessagingSystemPayload } from "@/lib/data/messaging";
import { userParticipatesInConversation } from "@/lib/data/messaging";

async function db() {
  const admin = createAdminSupabase();
  return admin ?? (await createServerSupabase());
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireMessagingGate() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "SEND_MESSAGES")) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

type ConvRow = {
  is_group: boolean | null;
  created_by: string | null;
  group_admin_profile_id: string | null;
};

function effectiveGroupAdminId(row: ConvRow): string | null {
  const d = row.group_admin_profile_id;
  if (d) return d;
  return row.created_by ?? null;
}

async function assertGroupParticipantAndAdmin(
  supabase: NonNullable<Awaited<ReturnType<typeof db>>>,
  conversationId: string,
  actingUserId: string,
): Promise<
  | { ok: true; row: ConvRow }
  | { ok: false; error: string }
> {
  const { data: c, error } = await supabase
    .from("conversations")
    .select("is_group,created_by,group_admin_profile_id")
    .eq("id", conversationId)
    .maybeSingle();
  const row = c as ConvRow | null;
  if (error || !row || !row.is_group) return { ok: false, error: "NOT_GROUP" };
  const part = await userParticipatesInConversation(actingUserId, conversationId);
  if (!part) return { ok: false, error: "NOT_PARTICIPANT" };
  const adminId = effectiveGroupAdminId(row);
  if (!adminId || adminId !== actingUserId) {
    return { ok: false, error: "NOT_GROUP_ADMIN" };
  }
  return { ok: true, row };
}

async function insertGroupSystemMessage(
  supabase: NonNullable<Awaited<ReturnType<typeof db>>>,
  conversationId: string,
  actorAuthUserId: string,
  payload: MessagingSystemPayload,
) {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: actorAuthUserId,
    kind: "system",
    body: "",
    system_payload: payload as unknown as Record<string, unknown>,
  });
  return error?.message ?? null;
}

async function participantCount(
  supabase: NonNullable<Awaited<ReturnType<typeof db>>>,
  conversationId: string,
): Promise<number> {
  const { count } = await supabase
    .from("conversation_participants")
    .select("profile_id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  return count ?? 0;
}

export async function addGroupMemberAction(
  locale: AppLocale,
  conversationId: string,
  targetProfileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireMessagingGate();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!UUID_RE.test(conversationId) || !UUID_RE.test(targetProfileId)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const chk = await assertGroupParticipantAndAdmin(
    supabase,
    conversationId,
    gate.user.id,
  );
  if (!chk.ok) return { ok: false, error: chk.error };

  const { data: exists } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", targetProfileId)
    .maybeSingle();
  if (exists?.profile_id) return { ok: false, error: "ALREADY_PARTICIPANT" };

  const { error: insErr } = await supabase.from("conversation_participants").insert({
    conversation_id: conversationId,
    profile_id: targetProfileId,
  });
  if (insErr) return { ok: false, error: insErr.message };

  const errMsg = await insertGroupSystemMessage(supabase, conversationId, gate.user.id, {
    type: "group_member_added",
    targetUserId: targetProfileId,
  });
  if (errMsg) {
    await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("profile_id", targetProfileId);
    return { ok: false, error: errMsg.slice(0, 240) };
  }

  revalidatePath(`/${locale}/messagerie`);
  revalidatePath(`/${locale}/messagerie/${conversationId}`);
  return { ok: true };
}

export async function removeGroupMemberAction(
  locale: AppLocale,
  conversationId: string,
  targetProfileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireMessagingGate();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!UUID_RE.test(conversationId) || !UUID_RE.test(targetProfileId)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const chk = await assertGroupParticipantAndAdmin(
    supabase,
    conversationId,
    gate.user.id,
  );
  if (!chk.ok) return { ok: false, error: chk.error };

  const effectiveAdmin = effectiveGroupAdminId(chk.row);
  if (targetProfileId === effectiveAdmin) {
    return { ok: false, error: "CANT_REMOVE_GROUP_ADMIN_BEFORE_TRANSFER" };
  }

  const n = await participantCount(supabase, conversationId);
  if (n <= 2) return { ok: false, error: "GROUP_MIN_TWO_PARTICIPANTS" };

  const { data: targ } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", targetProfileId)
    .maybeSingle();
  if (!targ?.profile_id) return { ok: false, error: "TARGET_NOT_PARTICIPANT" };

  const { error: delErr } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("profile_id", targetProfileId);
  if (delErr) return { ok: false, error: delErr.message };

  const errMsg = await insertGroupSystemMessage(supabase, conversationId, gate.user.id, {
    type: "group_member_removed",
    targetUserId: targetProfileId,
  });
  if (errMsg) {
    await supabase.from("conversation_participants").insert({
      conversation_id: conversationId,
      profile_id: targetProfileId,
    });
    return { ok: false, error: errMsg.slice(0, 240) };
  }

  revalidatePath(`/${locale}/messagerie`);
  revalidatePath(`/${locale}/messagerie/${conversationId}`);
  return { ok: true };
}

export async function transferGroupAdminAction(
  locale: AppLocale,
  conversationId: string,
  newAdminProfileId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireMessagingGate();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!UUID_RE.test(conversationId) || !UUID_RE.test(newAdminProfileId)) {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }

  const supabase = await db();
  if (!supabase) return { ok: false, error: "NO_DB" };

  const chk = await assertGroupParticipantAndAdmin(
    supabase,
    conversationId,
    gate.user.id,
  );
  if (!chk.ok) return { ok: false, error: chk.error };

  if (newAdminProfileId === gate.user.id) {
    return { ok: false, error: "ALREADY_ADMIN" };
  }

  const { data: newPart } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", newAdminProfileId)
    .maybeSingle();
  if (!newPart?.profile_id) return { ok: false, error: "NEW_ADMIN_NOT_PARTICIPANT" };

  const prevDesignatedAdmin = chk.row.group_admin_profile_id;

  const { error: updErr } = await supabase
    .from("conversations")
    .update({ group_admin_profile_id: newAdminProfileId })
    .eq("id", conversationId);
  if (updErr) return { ok: false, error: updErr.message };

  const insErrMsg = await insertGroupSystemMessage(
    supabase,
    conversationId,
    gate.user.id,
    { type: "group_admin_transferred", newAdminUserId: newAdminProfileId },
  );
  if (insErrMsg) {
    await supabase
      .from("conversations")
      .update({ group_admin_profile_id: prevDesignatedAdmin })
      .eq("id", conversationId);
    return { ok: false, error: insErrMsg.slice(0, 240) };
  }

  revalidatePath(`/${locale}/messagerie`);
  revalidatePath(`/${locale}/messagerie/${conversationId}`);
  return { ok: true };
}
