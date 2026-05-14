import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

/** Segment affiché dans les filtres du sélecteur de conversation (direction, équipe pédagogique, élèves). */
export type MessagingDirectorySegment =
  | "leadership"
  | "teachers"
  | "students";

export type MessagingDirectoryPerson = {
  /** Clé stable liste / React (distincte du compte Auth). */
  directoryKey: string;
  /** Compte Auth (`auth.users`) pour rejoindre une conversation ; null si pas encore activé. */
  participantAuthId: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  /** Étiquette courte : élève avec classe, rôle staff, etc. */
  subtitle: string | null;
  segment: MessagingDirectorySegment;
};

export type MessagingConversationListItem = {
  id: string;
  isGroup: boolean;
  /** Titre affiché (groupe ou interlocuteur). */
  title: string;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  /** Discussion 1-à-1 : photo de l’interlocuteur si connue. */
  peerAvatarUrl: string | null;
};

export type MessagingParticipant = {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  subtitle: string | null;
  lastReadAt: string | null;
  /** `profiles.base_role` lorsque présent ; null si uniquement lien table `students`. */
  baseRole: string | null;
  /** `students.id` si le participant est lié à une fiche élève (`auth_user_id`). */
  studentRowId: string | null;
};

export type MessagingSystemPayload =
  | { type: "group_member_added"; targetUserId: string }
  | { type: "group_member_removed"; targetUserId: string }
  | { type: "group_admin_transferred"; newAdminUserId: string };

export type MessagingMessageKind = "user" | "system";

/** Parse sécurisé du JSON système persisté dans `messages.system_payload`. */
export function parseMessagingSystemPayload(
  raw: unknown,
): MessagingSystemPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const typ = o.type;
  if (typ === "group_member_added" && typeof o.targetUserId === "string") {
    return { type: "group_member_added", targetUserId: o.targetUserId };
  }
  if (typ === "group_member_removed" && typeof o.targetUserId === "string") {
    return { type: "group_member_removed", targetUserId: o.targetUserId };
  }
  if (
    typ === "group_admin_transferred" &&
    typeof o.newAdminUserId === "string"
  ) {
    return {
      type: "group_admin_transferred",
      newAdminUserId: o.newAdminUserId,
    };
  }
  return null;
}

export type MessagingMessageRow = {
  id: string;
  senderId: string;
  kind: MessagingMessageKind;
  /** Interprété quand kind === « system ». */
  systemPayload: MessagingSystemPayload | null;
  body: string;
  sentAt: string;
  attachment:
    | {
        filename: string;
        mime: string | null;
        sizeBytes: number | null;
      }
    | null;
};

export type MessagingConversationGroupMeta = {
  creatorProfileId: string | null;
  /** valeur DB brute ; peut être null (rôle admin implicite = créateur côté app). */
  designatedAdminProfileId: string | null;
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

function messagingDirectorySegmentFromBaseRole(
  baseRole: string | null,
): MessagingDirectorySegment {
  if (baseRole === "DIRECTEUR" || baseRole === "ADMINISTRATEUR") {
    return "leadership";
  }
  if (baseRole === "ELEVE") {
    return "students";
  }
  return "teachers";
}

function compareDirectoryPeople(
  a: MessagingDirectoryPerson,
  b: MessagingDirectoryPerson,
): number {
  const ln = (a.lastName || "").localeCompare(b.lastName || "", undefined, {
    sensitivity: "base",
  });
  if (ln !== 0) return ln;
  return (a.firstName || "").localeCompare(b.firstName || "", undefined, {
    sensitivity: "base",
  });
}

const DIRECTORY_PAGE_SIZE = 500;

async function paginatedSelect<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const acc: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(
      offset,
      offset + DIRECTORY_PAGE_SIZE - 1,
    );
    if (error) break;
    const chunk = data ?? [];
    acc.push(...chunk);
    if (chunk.length < DIRECTORY_PAGE_SIZE) break;
    offset += DIRECTORY_PAGE_SIZE;
  }
  return acc;
}

type ProfileDirectoryRow = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  base_role: string | null;
};

type StudentDirectoryRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  /** Relation embarquée : objet ou tableau selon PostgREST / schéma. */
  classes?: unknown;
};

function classNameFromStudentEmbed(classes: unknown): string | null {
  if (!classes) return null;
  if (Array.isArray(classes)) {
    const n = (classes[0] as { name?: string | null } | undefined)?.name?.trim();
    return n && n.length > 0 ? n : null;
  }
  const n = (classes as { name?: string | null }).name?.trim();
  return n && n.length > 0 ? n : null;
}

/** Personnes dans l’annuaire messagerie : tout le personnel ; tous les dossiers élèves si `includeAllStudentRows` (personnel uniquement — pas les comptes élève). */
export async function fetchMessagingDirectoryPeople(
  currentProfileId: string,
  locale: "fr" | "en",
  includeAllStudentRows = true,
): Promise<MessagingDirectoryPerson[]> {
  const admin = createAdminSupabase();
  const supabase = admin ?? (await createServerSupabase());
  if (!supabase) return [];

  const roleLabel = locale === "fr" ? formatRoleFr : formatRoleEn;

  const profileRows = await paginatedSelect<ProfileDirectoryRow>(
    async (from, to) => {
      let q = supabase
        .from("profiles")
        .select("id,first_name,last_name,avatar_url,base_role")
        .neq("id", currentProfileId)
        .order("last_name");
      if (!includeAllStudentRows) {
        q = q.neq("base_role", "ELEVE");
      }
      return await q.range(from, to);
    },
  );

  const studentRows = includeAllStudentRows
    ? await paginatedSelect<StudentDirectoryRow>(async (from, to) =>
        await supabase
          .from("students")
          .select("id,auth_user_id,first_name,last_name,photo_url,classes(name)")
          .order("last_name")
          .range(from, to),
      )
    : [];

  const items: MessagingDirectoryPerson[] = [];
  /** Auth ids déjà présents sur une fiche `students` (évite doublon avec profil élève seul). */
  const studentAuthIdsWithRow = new Set<string>();

  for (const p of profileRows) {
    const br = p.base_role;
    if (br === "ELEVE") continue;
    items.push({
      directoryKey: `staff:${p.id}`,
      participantAuthId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      avatarUrl: p.avatar_url?.trim() ? p.avatar_url.trim() : null,
      subtitle: roleLabel(br),
      segment: messagingDirectorySegmentFromBaseRole(br),
    });
  }

  const eleveAvatarByAuth = new Map<string, string>();
  for (const p of profileRows) {
    if (p.base_role !== "ELEVE") continue;
    const u = p.avatar_url?.trim();
    if (u) eleveAvatarByAuth.set(p.id, u);
  }

  if (includeAllStudentRows) {
    for (const s of studentRows) {
      const sid = String(s.id);
      const aidRaw = s.auth_user_id?.trim() ?? "";
      const participantAuthId = aidRaw.length > 0 ? aidRaw : null;
      const clsName = classNameFromStudentEmbed(s.classes);

      const photo = s.photo_url?.trim();
      let avatarUrl = photo ? photo : null;
      if (participantAuthId) {
        const fromProf = eleveAvatarByAuth.get(participantAuthId);
        if (fromProf) avatarUrl = fromProf;
      }

      let subtitle: string;
      if (participantAuthId) {
        subtitle =
          clsName != null && clsName.length > 0
            ? locale === "fr"
              ? `Élève · ${clsName}`
              : `Student · ${clsName}`
            : locale === "fr"
              ? "Élève"
              : "Student";
      } else {
        subtitle =
          clsName != null && clsName.length > 0
            ? locale === "fr"
              ? `Élève · ${clsName} · Sans compte messager`
              : `Student · ${clsName} · No messaging login`
            : locale === "fr"
              ? "Élève · Sans compte messager"
              : "Student · No messaging login";
      }

      items.push({
        directoryKey: participantAuthId
          ? `student:${participantAuthId}`
          : `student-row:${sid}`,
        participantAuthId,
        firstName: String(s.first_name ?? ""),
        lastName: String(s.last_name ?? ""),
        avatarUrl,
        subtitle,
        segment: "students",
      });

      if (participantAuthId) studentAuthIdsWithRow.add(participantAuthId);
    }

    for (const p of profileRows) {
      if (p.base_role !== "ELEVE") continue;
      if (studentAuthIdsWithRow.has(p.id)) continue;

      items.push({
        directoryKey: `eleve-profile:${p.id}`,
        participantAuthId: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        avatarUrl: p.avatar_url?.trim() ? p.avatar_url.trim() : null,
        subtitle: locale === "fr" ? "Élève" : "Student",
        segment: "students",
      });
    }
  }

  items.sort(compareDirectoryPeople);
  return items;
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

function systemSnippetLocalized(
  locale: "fr" | "en",
  payload: MessagingSystemPayload,
  actorLabel: string,
  targetLabel: string,
): string {
  switch (payload.type) {
    case "group_member_added":
      return locale === "fr"
        ? `${actorLabel} a ajouté ${targetLabel}.`
        : `${actorLabel} added ${targetLabel}.`;
    case "group_member_removed":
      return locale === "fr"
        ? `${actorLabel} a retiré ${targetLabel}.`
        : `${actorLabel} removed ${targetLabel}.`;
    case "group_admin_transferred":
      return locale === "fr"
        ? `${actorLabel} a désigné ${targetLabel} administrateur du groupe.`
        : `${actorLabel} made ${targetLabel} the group admin.`;
    default:
      return locale === "fr" ? "(Activité groupe)" : "(Group activity)";
  }
}

async function lastMessageForConversation(
  supabase: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  conversationId: string,
  locale: "fr" | "en",
): Promise<{ snippet: string; sentAt: string } | null> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "body,sent_at,attachment_filename,kind,system_payload,sender_id",
    )
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const rawKind = ((data as { kind?: string }).kind ?? "user").toLowerCase();
  const senderIdRaw = String(
    (data as { sender_id?: string }).sender_id ?? "",
  ).trim();
  const sentAt = String((data as { sent_at: string }).sent_at);
  const rawPayload = (data as { system_payload?: unknown }).system_payload;

  if (rawKind === "system") {
    const payload = parseMessagingSystemPayload(rawPayload);
    let targetId =
      payload?.type === "group_admin_transferred"
        ? payload.newAdminUserId
        : payload && "targetUserId" in payload
          ? payload.targetUserId
          : "";
    const idsNeed = [...new Set([senderIdRaw, targetId].filter(Boolean))];
    const names =
      idsNeed.length > 0
        ? await hydrateDisplayNamesByUserIds(supabase, idsNeed)
        : new Map<string, string>();
    const unknown = locale === "fr" ? "Quelqu’un" : "Someone";
    const actorLabel = senderIdRaw
      ? (names.get(senderIdRaw)?.trim() || unknown)
      : unknown;
    const targetLabel = targetId
      ? (names.get(targetId)?.trim() || unknown)
      : unknown;
    const snippet =
      payload && actorLabel && targetLabel
        ? systemSnippetLocalized(locale, payload, actorLabel, targetLabel).slice(
            0,
            140,
          )
        : locale === "fr"
          ? "(Activité groupe)"
          : "(Group activity)";
    return {
      snippet,
      sentAt,
    };
  }

  const rawBody = String((data as { body?: string }).body ?? "").trim();
  const attachName =
    String(
      (data as { attachment_filename?: string | null }).attachment_filename ??
        "",
    ).trim();
  let snippet = rawBody.slice(0, 140);
  if (!snippet && attachName) {
    snippet =
      locale === "fr"
        ? `Fichier : ${attachName}`.slice(0, 140)
        : `File: ${attachName}`.slice(0, 140);
  }
  return {
    snippet,
    sentAt,
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

async function hydrateDisplayNamesByUserIds(
  supabase: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (!uniq.length) return out;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,first_name,last_name")
    .in("id", uniq);
  const seen = new Set<string>();
  for (const p of profiles ?? []) {
    const id = (p as { id: string }).id;
    seen.add(id);
    out.set(id, displayName(p as { first_name?: string; last_name?: string }));
  }

  const missing = uniq.filter((id) => !seen.has(id));
  if (!missing.length) return out;

  const { data: studs } = await supabase
    .from("students")
    .select("auth_user_id,first_name,last_name")
    .in("auth_user_id", missing);

  for (const s of studs ?? []) {
    const aid = (s as { auth_user_id?: string | null }).auth_user_id;
    if (!aid) continue;
    const label = displayName({
      first_name: (s as { first_name?: string }).first_name,
      last_name: (s as { last_name?: string }).last_name,
    });
    out.set(aid, label);
  }

  for (const id of missing) {
    if (!out.has(id)) out.set(id, "—");
  }
  return out;
}

async function hydrateAvatarUrlsByUserIds(
  supabase: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const uniq = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, string | null>();
  if (!uniq.length) return out;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,avatar_url")
    .in("id", uniq);

  const profAvatar = new Map<string, string | null>();
  for (const r of profiles ?? []) {
    const id = (r as { id: string }).id;
    const u = (r as { avatar_url: string | null }).avatar_url?.trim() || "";
    profAvatar.set(id, u ? u : null);
  }

  const needFallback: string[] = [];
  for (const id of uniq) {
    const fromProf = profAvatar.get(id);
    if (fromProf) {
      out.set(id, fromProf);
    } else {
      needFallback.push(id);
      out.set(id, null);
    }
  }

  if (needFallback.length) {
    const { data: studs } = await supabase
      .from("students")
      .select("auth_user_id,photo_url")
      .in("auth_user_id", needFallback);
    const byAuth = new Map<string, string>();
    for (const s of studs ?? []) {
      const aid = (s as { auth_user_id?: string | null }).auth_user_id;
      const ph = (s as { photo_url?: string | null }).photo_url?.trim();
      if (aid && ph) byAuth.set(aid, ph);
    }
    for (const id of needFallback) {
      const ph = byAuth.get(id);
      if (ph) out.set(id, ph);
    }
  }

  return out;
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
  const nameById =
    peerIds.length > 0 ? await hydrateDisplayNamesByUserIds(supabase, peerIds) : new Map<string, string>();
  const avatarByPeerId =
    peerIds.length > 0 ? await hydrateAvatarUrlsByUserIds(supabase, peerIds) : new Map<string, string | null>();

  const items: MessagingConversationListItem[] = [];

  for (const c of convRows as {
    id: string;
    is_group: boolean | null;
    name: string | null;
    created_at: string;
  }[]) {
    const last = await lastMessageForConversation(supabase, c.id, locale);
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
    const dmPeers = peersByConv.get(c.id) ?? [];
    const peerForAvatar = !c.is_group ? dmPeers[0] : undefined;
    const peerAvatarUrl = peerForAvatar
      ? (avatarByPeerId.get(peerForAvatar) ?? null)
      : null;

    items.push({
      id: c.id,
      isGroup: Boolean(c.is_group),
      title,
      lastMessageSnippet: last?.snippet ?? null,
      lastMessageAt: lastAt,
      unreadCount: unread,
      peerAvatarUrl,
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
    .select("id,auth_user_id,class_id,photo_url,classes(name)")
    .in("auth_user_id", ids);

  const classByAuth = new Map<string, string>();
  const studentPhotoByAuth = new Map<string, string>();
  const studentRowByAuth = new Map<string, string>();
  for (const s of students ?? []) {
    const aid = (s as { auth_user_id?: string | null }).auth_user_id;
    const sid = (s as { id: string }).id;
    const cls = (s as { classes?: { name?: string } | null }).classes;
    const name = cls?.name?.trim();
    if (aid && name) classByAuth.set(aid, name);
    const ph = (s as { photo_url?: string | null }).photo_url?.trim();
    if (aid && ph) studentPhotoByAuth.set(aid, ph);
    if (aid && sid) studentRowByAuth.set(aid, sid);
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

  const nameByParticipant = await hydrateDisplayNamesByUserIds(supabase, ids);

  return (parts as { profile_id: string; last_read_at: string | null }[]).map(
    (row) => {
      const p = profById.get(row.profile_id);
      const br = p?.base_role ?? null;
      const className = classByAuth.get(row.profile_id) ?? null;
      const subtitle = className
        ? locale === "fr"
          ? `Élève · ${className}`
          : `Student · ${className}`
        : roleLabel(br);

      const fromProfile = p?.avatar_url?.trim() || "";
      const avatarUrl =
        fromProfile || studentPhotoByAuth.get(row.profile_id) || null;

      return {
        profileId: row.profile_id,
        displayName: nameByParticipant.get(row.profile_id) ?? displayName(p ?? null),
        avatarUrl,
        subtitle,
        lastReadAt: row.last_read_at,
        baseRole: br,
        studentRowId: studentRowByAuth.get(row.profile_id) ?? null,
      };
    },
  );
}

export async function fetchConversationGroupMeta(
  conversationId: string,
): Promise<MessagingConversationGroupMeta | null> {
  const supabase = await getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("conversations")
    .select("is_group,created_by,group_admin_profile_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as {
    is_group?: boolean | null;
    created_by?: string | null;
    group_admin_profile_id?: string | null;
  };
  if (!row.is_group) return null;

  return {
    creatorProfileId: row.created_by ?? null,
    designatedAdminProfileId: row.group_admin_profile_id ?? null,
  };
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<MessagingMessageRow[]> {
  const supabase = await getClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id,sender_id,kind,body,sent_at,system_payload,attachment_filename,attachment_mime,attachment_size_bytes",
    )
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });

  if (error || !data) return [];

  return (
    data as {
      id: string;
      sender_id: string;
      kind?: string | null;
      body: string;
      sent_at: string;
      system_payload?: unknown | null;
      attachment_filename: string | null;
      attachment_mime: string | null;
      attachment_size_bytes: number | null;
    }[]
  ).map((m) => {
    const fname = (m.attachment_filename ?? "").trim();
    const k = ((m.kind ?? "user") as string).toLowerCase();
    const kind: MessagingMessageKind = k === "system" ? "system" : "user";
    return {
      id: m.id,
      senderId: m.sender_id,
      kind,
      systemPayload:
        kind === "system" ? parseMessagingSystemPayload(m.system_payload) : null,
      body: m.body ?? "",
      sentAt: m.sent_at,
      attachment: fname
        ? {
            filename: fname,
            mime: m.attachment_mime ?? null,
            sizeBytes:
              typeof m.attachment_size_bytes === "number"
                ? m.attachment_size_bytes
                : null,
          }
        : null,
    };
  });
}

/** Temps moyen (minutes) entre un message entrant et la prochaine réponse d’une autre personne. */
export function computeAverageResponseMinutes(
  messages: MessagingMessageRow[],
): number | null {
  const usable = messages.filter((m) => m.kind === "user");
  if (usable.length < 2) return null;
  const deltas: number[] = [];
  for (let i = 1; i < usable.length; i += 1) {
    const prev = usable[i - 1];
    const cur = usable[i];
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
