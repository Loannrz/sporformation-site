import type { SupabaseClient } from "@supabase/supabase-js";

export type VoluntaryDocumentScopeKind = "all_staff_teachers" | "selected";

export type TeacherVoluntaryRequestRow = {
  id: string;
  label: string;
  description: string | null;
  scope_kind: VoluntaryDocumentScopeKind;
  status: "open" | "closed";
  created_by: string;
  created_at: string;
  closed_at: string | null;
};

export type VoluntaryCampaignAdminRow = TeacherVoluntaryRequestRow & {
  totalRecipients: number;
  filledRecipients: number;
};

export type VoluntaryRecipientPendingForUser = {
  recipientId: string;
  requestId: string;
  label: string;
  description: string | null;
};

/** Liste identique aux pending mais pour lignes invalide après refus admin (sans fichier). */
export type VoluntaryRecipientInvalidatedForUser = VoluntaryRecipientPendingForUser;

/** Lignes voluntary pour la fiche admin compte enseignant (campagnes ouvertes ou clôturées). */
export type VoluntaryRecipientForTeacherProfileAdmin = {
  recipientId: string;
  requestId: string;
  label: string;
  description: string | null;
  campaignStatus: "open" | "closed";
  file_id: string | null;
  uploaded_at: string | null;
  admin_excused_at: string | null;
};

/** Une ligne destinataire pour une campagne (panneau admin / modale). */
export type VoluntaryRecipientRowForCampaign = {
  id: string;
  teacher_profile_id: string;
  file_id: string | null;
  uploaded_at: string | null;
  admin_excused_at: string | null;
  voluntary_invalidated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export async function fetchVoluntaryRecipientsForTeacherProfileAdmin(
  admin: SupabaseClient,
  teacherProfileId: string,
): Promise<VoluntaryRecipientForTeacherProfileAdmin[]> {
  const { data: recs, error } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      file_id,
      uploaded_at,
      admin_excused_at,
      request_id,
      teacher_voluntary_document_requests!inner (
        id,
        label,
        description,
        status
      )
    `,
    )
    .eq("teacher_profile_id", teacherProfileId)
    .order("uploaded_at", { ascending: false, nullsFirst: true });

  if (error || !recs?.length) {
    if (error) {
      console.warn("fetchVoluntaryRecipientsForTeacherProfileAdmin:", error.message);
    }
    return [];
  }

  return recs.map((r) => {
    const req = r.teacher_voluntary_document_requests as unknown as {
      id: string;
      label: string;
      description: string | null;
      status: string;
    };
    const st = req.status === "closed" ? "closed" : "open";
    return {
      recipientId: r.id as string,
      requestId: req.id,
      label: req.label,
      description: req.description,
      campaignStatus: st as "open" | "closed",
      file_id: (r.file_id as string | null) ?? null,
      uploaded_at: (r.uploaded_at as string | null) ?? null,
      admin_excused_at: (r.admin_excused_at as string | null) ?? null,
    };
  });
}

/** Campagnes ouvertes + comptages destinataires (admin). */
export async function fetchVoluntaryCampaignsForAdmin(
  admin: SupabaseClient,
): Promise<VoluntaryCampaignAdminRow[]> {
  const { data: reqs, error } = await admin
    .from("teacher_voluntary_document_requests")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("fetchVoluntaryCampaignsForAdmin:", error.message);
    return [];
  }
  if (!reqs?.length) return [];

  const ids = reqs.map((r) => r.id as string);
  const { data: recs } = await admin
    .from("teacher_voluntary_document_recipients")
    .select("request_id, file_id")
    .in("request_id", ids);

  const meta = new Map<string, { total: number; filled: number }>();
  for (const id of ids) {
    meta.set(id, { total: 0, filled: 0 });
  }
  for (const row of recs ?? []) {
    const rid = row.request_id as string;
    const m = meta.get(rid);
    if (!m) continue;
    m.total += 1;
    if (row.file_id) m.filled += 1;
  }

  return (reqs as TeacherVoluntaryRequestRow[]).map((r) => {
    const m = meta.get(r.id) ?? { total: 0, filled: 0 };
    return {
      ...r,
      totalRecipients: m.total,
      filledRecipients: m.filled,
    };
  });
}

/** Demandes ouvertes non déposées pour un enseignant (profil cible). */
export async function fetchOpenVoluntaryRecipientsPendingForUser(
  admin: SupabaseClient,
  teacherProfileId: string,
): Promise<VoluntaryRecipientPendingForUser[]> {
  const { data: recs, error } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      teacher_profile_id,
      file_id,
      request_id,
      teacher_voluntary_document_requests!inner (
        id,
        label,
        description,
        status
      )
    `,
    )
    .eq("teacher_profile_id", teacherProfileId)
    .is("file_id", null)
    .is("admin_excused_at", null)
    .is("voluntary_invalidated_at", null);

  if (error || !recs?.length) {
    if (error) {
      console.warn("fetchOpenVoluntaryRecipientsPendingForUser:", error.message);
    }
    return [];
  }

  const out: VoluntaryRecipientPendingForUser[] = [];
  for (const row of recs) {
    const req = row.teacher_voluntary_document_requests as unknown as {
      id: string;
      label: string;
      description: string | null;
      status: string;
    };
    if (req.status !== "open") continue;
    out.push({
      recipientId: row.id as string,
      requestId: req.id,
      label: req.label,
      description: req.description,
    });
  }
  return out;
}

/** Campagnes ouvertes où l’administrateur a rejeté le dernier fichier (à renvoyer). */
export async function fetchVoluntaryRecipientsInvalidatedForUser(
  admin: SupabaseClient,
  teacherProfileId: string,
): Promise<VoluntaryRecipientInvalidatedForUser[]> {
  const { data: recs, error } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      request_id,
      teacher_voluntary_document_requests!inner (
        id,
        label,
        description,
        status
      )
    `,
    )
    .eq("teacher_profile_id", teacherProfileId)
    .is("file_id", null)
    .not("voluntary_invalidated_at", "is", null)
    .is("admin_excused_at", null);

  if (error || !recs?.length) {
    if (error) {
      console.warn("fetchVoluntaryRecipientsInvalidatedForUser:", error.message);
    }
    return [];
  }

  const out: VoluntaryRecipientInvalidatedForUser[] = [];
  for (const row of recs) {
    const req = row.teacher_voluntary_document_requests as unknown as {
      id: string;
      label: string;
      description: string | null;
      status: string;
    };
    if (req.status !== "open") continue;
    out.push({
      recipientId: row.id as string,
      requestId: req.id,
      label: req.label,
      description: req.description,
    });
  }
  return out;
}

/** IDs profils enseignants (PROFESSEUR / PROF_PRINCIPAL) pour ciblage « tous ». */
export async function fetchAllTeacherProfileIdsForVoluntary(
  admin: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .in("base_role", ["PROFESSEUR", "PROF_PRINCIPAL"]);

  if (error || !data) {
    if (error) console.warn("fetchAllTeacherProfileIdsForVoluntary:", error.message);
    return [];
  }
  return data.map((r) => r.id as string);
}

/** Lignes destinataires pour une campagne (suivi détaillé admin). */
export async function fetchVoluntaryRecipientsForRequest(
  admin: SupabaseClient,
  requestId: string,
): Promise<VoluntaryRecipientRowForCampaign[]> {
  const { data: recs, error } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      "id, teacher_profile_id, file_id, uploaded_at, admin_excused_at, voluntary_invalidated_at",
    )
    .eq("request_id", requestId);

  if (error || !recs?.length) return [];

  const teacherIds = [...new Set(recs.map((r) => r.teacher_profile_id as string))];
  const { data: profs } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", teacherIds);

  const nameMap = new Map(
    (profs ?? []).map((p) => [
      p.id as string,
      {
        first_name: (p.first_name as string | null) ?? null,
        last_name: (p.last_name as string | null) ?? null,
        email: (p.email as string | null) ?? null,
      },
    ]),
  );

  return recs.map((r) => {
    const nm = nameMap.get(r.teacher_profile_id as string);
    return {
      id: r.id as string,
      teacher_profile_id: r.teacher_profile_id as string,
      file_id: (r.file_id as string | null) ?? null,
      uploaded_at: (r.uploaded_at as string | null) ?? null,
      admin_excused_at: (r.admin_excused_at as string | null) ?? null,
      voluntary_invalidated_at: (r.voluntary_invalidated_at as string | null) ?? null,
      first_name: nm?.first_name ?? null,
      last_name: nm?.last_name ?? null,
      email: nm?.email ?? null,
    };
  });
}

/** Page dépôt enseignant : campagnes ouvertes pour ce profil (avec ou sans fichier). */
export async function fetchVoluntaryRecipientsForTeacherPage(
  admin: SupabaseClient,
  teacherProfileId: string,
): Promise<
  {
    recipientId: string;
    requestId: string;
    label: string;
    description: string | null;
    file_id: string | null;
    file_title: string | null;
    needsReuploadDueToInvalidation: boolean;
  }[]
> {
  const { data: recs, error } = await admin
    .from("teacher_voluntary_document_recipients")
    .select(
      `
      id,
      file_id,
      admin_excused_at,
      voluntary_invalidated_at,
      request_id,
      teacher_voluntary_document_requests!inner (
        id,
        label,
        description,
        status
      )
    `,
    )
    .eq("teacher_profile_id", teacherProfileId);

  if (error || !recs?.length) {
    if (error) console.warn("fetchVoluntaryRecipientsForTeacherPage:", error.message);
    return [];
  }

  const open = recs.filter((r) => {
    const req = r.teacher_voluntary_document_requests as unknown as { status: string };
    const excused = Boolean(r.admin_excused_at as string | null);
    return req.status === "open" && !excused;
  });
  if (!open.length) return [];

  const fileIds = open
    .map((r) => r.file_id as string | null)
    .filter((x): x is string => Boolean(x));
  let titles: Record<string, string> = {};
  if (fileIds.length) {
    const { data: files } = await admin.from("files").select("id, title").in("id", fileIds);
    titles = Object.fromEntries((files ?? []).map((f) => [f.id as string, (f.title as string) || ""]));
  }

  return open.map((r) => {
    const req = r.teacher_voluntary_document_requests as unknown as {
      id: string;
      label: string;
      description: string | null;
    };
    const fid = r.file_id as string | null;
    return {
      recipientId: r.id as string,
      requestId: req.id,
      label: req.label,
      description: req.description,
      file_id: fid,
      file_title: fid ? titles[fid] ?? null : null,
      needsReuploadDueToInvalidation: Boolean(r.voluntary_invalidated_at),
    };
  });
}
