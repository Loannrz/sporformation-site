import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type MessagingDirectoryPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Étiquette courte : élève avec classe, rôle staff, etc. */
  subtitle: string | null;
};

export type MessagingConversationListItem = {
  id: string;
  isGroup: boolean;
  /** Titre affiché (groupe ou interlocuteur). */
  title: string;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type MessagingParticipant = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  subtitle: string | null;
  lastReadAt: string | null;
};

export type MessagingMessageRow = {
  id: string;
  senderId: string;
  body: string;
  sentAt: string;
};

function formatRoleFr(baseRole: string | null): string {
  switch (baseRole) {
    case "DIRECTEUR":
      return "Direction";
    case "ADMINISTRATEUR":
      return "Administration";
    case "PROF_PRINCIPAL":
      return "Professeur principal";
    case "PROFESSEUR":
      return "Enseignant";
    case "ELEVE":
      return "Élève";
    default:
      return "Personnel";
  }
}

function formatRoleEn(baseRole: string | null): string {
  switch (baseRole) {
    case "DIRECTEUR":
      return "Leadership";
    case "ADMINISTRATEUR":
      return "Administrator";
    case "PROF_PRINCIPAL":
      return "Head teacher";
    case "PROFESSEUR":
      return "Teacher";
    case "ELEVE":
      return "Student";
    default:
      return "Staff";
  }
}

/** Personnes pouvant être ajoutées à une conversation (profils hors soi-même). */
export async function fetchMessagingDirectoryPeople(
  currentProfileId: string,
  locale: "fr" | "en",
): Promise<MessagingDirectoryPerson[]> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await createServerSupabase());
  if (!supabase) return [];

  const roleLabel = locale === "fr" ? formatRoleFr : formatRoleEn;

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select(
      "id,first_name,last_name,avatar_url,base_role",
    )
    .neq("id", currentProfileId)
    .order("last_name");

  if (pErr || !profiles?.length) return [];

  const { data: students } = await supabase
    .from("students")
    .select("auth_user_id,class_id,classes(name)")
    .not("auth_user_id", "is", null);

  const classByAuth = new Map<string, string>();
  for (const s of students ?? []) {
    const aid = (s as { auth_user_id?: string | null }).auth_user_id;
    const cls = (s as { classes?: { name?: string } | null }).classes;
    const name = cls?.name?.trim();
    if (aid && name) classByAuth.set(aid, name);
  }

  return (profiles as {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    base_role: string | null;
  }[]).map((p) => {
    const br = p.base_role;
    const className = classByAuth.get(p.id) ?? null;
    const subtitle =
      br === "ELEVE" && className
        ? locale === "fr"
          ? `Élève · ${className}`
          : `Student · ${className}`
        : roleLabel(br);

    return {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      avatarUrl: p.avatar_url,
      subtitle,
    };
  });
}

async function getClient() {
  const admin = createAdminSupabase();
  return admin ?? (await createServerSupabase());
}

export async function userParticipatesInConversation(
  profileId: string,
  conversationId: string,
): Promise<boolean> {
  const supabase = await getClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return Boolean(data?.conversation_id);
}

export async function fetchTotalUnreadMessageCount(
  profileId: string,
): Promise<number> {
  const list = await fetchMessagingConversationsList(profileId, "fr");
  return list.reduce((s, c) => s + c.unreadCount, 0);
}

async function lastMessageForConversation(
  supabase: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  conversationId: string,
): Promise<{ body: string; sentAt: string } | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("body,sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    body: String((data as { body: string }).body ?? ""),
    sentAt: String((data as { sent_at: string }).sent_at),
  };
}

async function unreadCountFor(
  supabase: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  conversationId: string,
  profileId: string,
  lastReadAt: string | null,
): Promise<number> {
  let q = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", profileId);
  if (lastReadAt) {
    q = q.gt("sent_at", lastReadAt);
  }
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

function displayName(
  p: { first_name?: string; last_name?: string } | null,
): string {
  if (!p) return "—";
  const n = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return n || "—";
}

export async function fetchMessagingConversationsList(
  profileId: string,
  locale: "fr" | "en",
): Promise<MessagingConversationListItem[]> {
  const supabase = await getClient();
  if (!supabase) return [];

  const { data: parts, error: partErr } = await supabase
    .from("conversation_participants")
    .select("conversation_id,last_read_at")
    .eq("profile_id", profileId);

  if (partErr || !parts?.length) return [];

  const convIds = [
    ...new Set(
      (parts as { conversation_id: string }[]).map((p) => p.conversation_id),
    ),
  ];
  const readMap = new Map(
    (parts as { conversation_id: string; last_read_at: string | null }[]).map(
      (p) => [p.conversation_id, p.last_read_at],
    ),
  );

  const { data: convRows, error: cErr } = await supabase
    .from("conversations")
    .select("id,is_group,name,created_at")
    .in("id", convIds);

  if (cErr || !convRows?.length) return [];

  const { data: allParts } = await supabase
    .from("conversation_participants")
    .select("conversation_id,profile_id")
    .in("conversation_id", convIds);

  const peersByConv = new Map<string, string[]>();
  for (const row of allParts ?? []) {
    const cid = (row as { conversation_id: string }).conversation_id;
    const pid = (row as { profile_id: string }).profile_id;
    if (pid === profileId) continue;
    const arr = peersByConv.get(cid) ?? [];
    arr.push(pid);
    peersByConv.set(cid, arr);
  }

  const peerIds = [...new Set([...peersByConv.values()].flat())];
  const { data: peerProfiles } = peerIds.length
    ? await supabase
        .from("profiles")
        .select("id,first_name,last_name")
        .in("id", peerIds)
    : { data: [] };

  const nameById = new Map(
    (peerProfiles as { id: string; first_name: string; last_name: string }[] | null)?.map(
      (p) => [p.id, displayName(p)],
    ) ?? [],
  );

  const items: MessagingConversationListItem[] = [];

  for (const c of convRows as {
    id: string;
    is_group: boolean | null;
    name: string | null;
    created_at: string;
  }[]) {
    const last = await lastMessageForConversation(supabase, c.id);
    const unread = await unreadCountFor(
      supabase,
      c.id,
      profileId,
      readMap.get(c.id) ?? null,
    );

    let title: string;
    if (c.is_group) {
      const raw = (c.name ?? "").trim();
      title =
        raw ||
        (locale === "fr" ? "Groupe" : "Group");
    } else {
      const peers = peersByConv.get(c.id) ?? [];
      const other = peers[0];
      title = other ? (nameById.get(other) ?? "—") : locale === "fr" ? "Discussion" : "Chat";
    }

    const lastAt = last?.sentAt ?? c.created_at;

    items.push({
      id: c.id,
      isGroup: Boolean(c.is_group),
      title,
      lastMessageSnippet: last?.body.slice(0, 140) ?? null,
      lastMessageAt: lastAt,
      unreadCount: unread,
    });
  }

  items.sort((a, b) => {
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });

  return items;
}

export async function fetchConversationParticipants(
  conversationId: string,
  locale: "fr" | "en",
): Promise<MessagingParticipant[]> {
  const supabase = await getClient();
  if (!supabase) return [];

  const { data: parts, error } = await supabase
    .from("conversation_participants")
    .select("profile_id,last_read_at")
    .eq("conversation_id", conversationId);

  if (error || !parts?.length) return [];

  const ids = (parts as { profile_id: string }[]).map((p) => p.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,avatar_url,base_role")
    .in("id", ids);

  const { data: students } = await supabase
    .from("students")
    .select("auth_user_id,class_id,classes(name)")
    .in("auth_user_id", ids);

  const classByAuth = new Map<string, string>();
  for (const s of students ?? []) {
    const aid = (s as { auth_user_id?: string | null }).auth_user_id;
    const cls = (s as { classes?: { name?: string } | null }).classes;
    const name = cls?.name?.trim();
    if (aid && name) classByAuth.set(aid, name);
  }

  const roleLabel = locale === "fr" ? formatRoleFr : formatRoleEn;
  const profById = new Map(
    (profiles as {
      id: string;
      first_name: string;
      last_name: string;
      avatar_url: string | null;
      base_role: string | null;
    }[] | null)?.map((p) => [p.id, p]) ?? [],
  );

  return (parts as { profile_id: string; last_read_at: string | null }[]).map(
    (row) => {
      const p = profById.get(row.profile_id);
      const br = p?.base_role ?? null;
      const className = classByAuth.get(row.profile_id) ?? null;
      const subtitle =
        br === "ELEVE" && className
          ? locale === "fr"
            ? `Élève · ${className}`
            : `Student · ${className}`
          : roleLabel(br);

      return {
        profileId: row.profile_id,
        displayName: displayName(p ?? null),
        avatarUrl: p?.avatar_url ?? null,
        subtitle,
        lastReadAt: row.last_read_at,
      };
    },
  );
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<MessagingMessageRow[]> {
  const supabase = await getClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id,sender_id,body,sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });

  if (error || !data) return [];

  return (data as { id: string; sender_id: string; body: string; sent_at: string }[]).map(
    (m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      sentAt: m.sent_at,
    }),
  );
}

/** Temps moyen (minutes) entre un message entrant et la prochaine réponse d’une autre personne. */
export function computeAverageResponseMinutes(
  messages: MessagingMessageRow[],
): number | null {
  if (messages.length < 2) return null;
  const deltas: number[] = [];
  for (let i = 1; i < messages.length; i += 1) {
    const prev = messages[i - 1];
    const cur = messages[i];
    if (cur.senderId !== prev.senderId) {
      const d =
        new Date(cur.sentAt).getTime() - new Date(prev.sentAt).getTime();
      if (d >= 0) deltas.push(d / 60_000);
    }
  }
  if (!deltas.length) return null;
  const sum = deltas.reduce((a, b) => a + b, 0);
  return Math.round((sum / deltas.length) * 10) / 10;
}

export async function getMaxMessageSentAt(
  conversationId: string,
): Promise<string | null> {
  const supabase = await getClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("messages")
    .select("sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { sent_at?: string } | null)?.sent_at ?? null;
}
