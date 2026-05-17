/**
 * Lecture / mise à jour des dossiers d’inscription portail — service role uniquement.
 */

import type { SubmissionFilesMap } from "@/lib/inscription-submission-progress";
import { computeInscriptionProgress } from "@/lib/inscription-submission-progress";
import { INSCRIPTION_PUBLIC_UPLOAD_BUCKET_NAME } from "@/lib/inscription-public-upload-url";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type SubmissionStatusPortal = "draft" | "submitted";

export type AdminReviewStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "needs_completion";

/** Marqué « À corriger » côté admin ; absent des clés → conforme implicitement. */
export type AdminFieldReviewEntry = { message?: string | null };

export type AdminFieldFlagsMap = Record<string, AdminFieldReviewEntry>;

export type InscriptionSubmissionAdminRow = {
  id: string;
  portal_account_id: string;
  template_id: string;
  formation_slug: string;
  ville_slug: string;
  status: SubmissionStatusPortal;
  answers: Record<string, unknown>;
  files: SubmissionFilesMap;
  current_step_index: number;
  progress_percent: number;
  progress_computed_percent: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  admin_review_status: AdminReviewStatus | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  reviewer_profile_id: string | null;
  admin_field_flags: AdminFieldFlagsMap;
  /** Message global pour le candidat (portail) lors d’une demande de corrections. */
  candidate_revision_notice: string | null;
  /** Colonnes Identification (formulaire portail, clés answers portal_ident_*). */
  candidate_nom: string | null;
  candidate_prenom: string | null;
  candidate_email: string | null;
  portal_email: string | null;
  portal_first_name: string | null;
  portal_last_name: string | null;
  template_title: string;
  template_slug: string;
  template_definition: unknown;
};


/**
 * Postgres / `@supabase/*` peuvent renvoyer des UUID v7, NIL, etc. Une regex trop stricte
 * rejette des identifiants valides → aucun `.in()`, donc aucun chargement depuis `portal_accounts`.
 */
const UUID_LOOKUP_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Taille maximale conseillée par requête pour `.in('id', …)`. */
const PORTAL_BATCH_IN_CHUNK = 120;

/** Normalise une clé UUID (minuscules) si le format avec tirets correspond. */
function canonicalUuidLookupKey(raw: unknown): string | undefined {
  const s =
    typeof raw === "string" ? raw.trim() : raw != null ? String(raw).trim() : "";
  if (!s) return undefined;
  const lower = s.toLowerCase();
  return UUID_LOOKUP_RE.test(lower) ? lower : undefined;
}

/** Déduplication des identifiants passés aux `.in("id", …)` (toujours la forme permissive lookup). */
function uniqueCanonicalPortalIds(ids: string[]): string[] {
  const keys = ids
    .map((id) => canonicalUuidLookupKey(id))
    .filter((k): k is string => typeof k === "string");
  return [...new Set(keys)];
}

/**
 * Ne pas lister explicitement des colonnes ajoutées par migrations ultérieures :
 * si la migration n’est pas appliquée en base, PostgREST échoue → liste vide (cartes disparues).
 * `*` suit le schéma réellement déployé.
 */
const SELECT_INSCRIPTION_SUBMISSION_ROW = "*";

/** UUID normalisé (casse) pour clés Map / PostgREST. */
function submissionPortalAccountId(raw: Record<string, unknown>): string {
  return canonicalUuidLookupKey(raw.portal_account_id) ?? "";
}

/** Même normalisation UUID pour les modèles de formulaire. */
function submissionTemplateId(raw: Record<string, unknown>): string {
  return canonicalUuidLookupKey(raw.template_id) ?? "";
}

/** Clé Map pour lignes `{ id: uuid }` renvoyées par PostgREST. */
function uuidRowKey(rowId: unknown): string {
  return canonicalUuidLookupKey(rowId) ?? "";
}

function portalAccountsEmbedFromRow(
  raw: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const e = raw.portal_accounts;
  if (e == null) return undefined;
  if (Array.isArray(e)) {
    const first = e[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return first as Record<string, unknown>;
    }
    return undefined;
  }
  if (typeof e === "object") return e as Record<string, unknown>;
  return undefined;
}

function portalPrimaryEmail(portal?: Record<string, unknown> | undefined): string | null {
  if (!portal) return null;
  const raw = portal.email;
  if (raw === null || raw === undefined) return null;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return s.length > 0 ? s : null;
}

function portalRowHasEmail(row: Record<string, unknown>): boolean {
  return portalPrimaryEmail(row) !== null;
}

/** Préfère l’e-mail du compte `portal_accounts` (chargement `.in()` + fusion). */
function mergePortalAccountPayload(
  raw: Record<string, unknown>,
  pid: string,
  portalMap: Map<string, Record<string, unknown>>,
): Record<string, unknown> {
  const fromMap = pid ? portalMap.get(pid) : undefined;
  const fromEmbed = portalAccountsEmbedFromRow(raw);
  const mapOk = fromMap && portalRowHasEmail(fromMap);
  const embedOk = fromEmbed && portalRowHasEmail(fromEmbed);
  if (mapOk && embedOk) return { ...fromEmbed!, ...fromMap! };
  if (mapOk) return fromMap!;
  if (embedOk) return fromEmbed!;
  if (fromMap && Object.keys(fromMap).length) return fromMap;
  if (fromEmbed && Object.keys(fromEmbed).length) return fromEmbed;
  return {};
}

function parseAdminFieldFlags(raw: unknown): AdminFieldFlagsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AdminFieldFlagsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const fid = k.trim();
    if (!fid) continue;
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      continue;
    }
    const o = v as Record<string, unknown>;
    const message =
      typeof o.message === "string" ? String(o.message).trim() || undefined : undefined;
    out[fid] = message ? { message } : {};
  }
  return out;
}

export type InscriptionSubmissionListFilters = {
  status?: SubmissionStatusPortal | "all";
  formationSlug?: string;
  villeSlug?: string;
  q?: string;
};

/** Charge les lignes `portal_accounts` puis fusion avec le dossier (pas de sous-select sur la liste pour éviter les erreurs PostgREST). */
async function loadPortalAccountsBriefMap(
  admin: import("@supabase/supabase-js").SupabaseClient,
  ids: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = uniqueCanonicalPortalIds(ids);
  if (!unique.length) return map;

  for (let i = 0; i < unique.length; i += PORTAL_BATCH_IN_CHUNK) {
    const slice = unique.slice(i, i + PORTAL_BATCH_IN_CHUNK);
    const { data, error } = await admin
      .from("portal_accounts")
      .select("id, email, first_name, last_name")
      .in("id", slice);

    if (error || !Array.isArray(data)) {
      console.error(
        "[inscription_submissions] loadPortalAccountsBriefMap:",
        error?.message ?? error,
      );
      continue;
    }

    for (const row of data as Record<string, unknown>[]) {
      const sid = uuidRowKey(row.id);
      if (sid) map.set(sid, row);
    }
  }

  return map;
}

async function loadInscriptionTemplatesBriefMap(
  admin: import("@supabase/supabase-js").SupabaseClient,
  ids: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = uniqueCanonicalPortalIds(ids);
  if (!unique.length) return map;

  for (let i = 0; i < unique.length; i += PORTAL_BATCH_IN_CHUNK) {
    const slice = unique.slice(i, i + PORTAL_BATCH_IN_CHUNK);
    const { data, error } = await admin
      .from("inscription_templates")
      .select("id, title, slug, definition")
      .in("id", slice);

    if (error || !Array.isArray(data)) {
      console.error(
        "[inscription_submissions] loadInscriptionTemplatesBriefMap:",
        error?.message ?? error,
      );
      continue;
    }

    for (const row of data as Record<string, unknown>[]) {
      const sid = uuidRowKey(row.id);
      if (sid) map.set(sid, row);
    }
  }

  return map;
}

function finalizeAdminSubmissionRow(
  raw: Record<string, unknown>,
  portalMap: Map<string, Record<string, unknown>>,
  templateMap: Map<string, Record<string, unknown>>,
): InscriptionSubmissionAdminRow {
  const pid = submissionPortalAccountId(raw);
  const tid = submissionTemplateId(raw);

  const portal = mergePortalAccountPayload(raw, pid, portalMap);
  const tmpl = tid ? templateMap.get(tid) : undefined;

  const merged: Record<string, unknown> = {
    ...raw,
    portal_account_id: pid || raw.portal_account_id,
    portal_accounts: portal,
    inscription_templates: tmpl ?? {},
  };

  const tmplDef =
    tmpl && typeof tmpl === "object" && "definition" in tmpl
      ? (tmpl as { definition?: unknown }).definition
      : undefined;

  const parsed = parseSubmissionRow(merged, tmplDef);

  return {
    ...parsed,
    template_definition: tmplDef,
  } as InscriptionSubmissionAdminRow;
}

function parseSubmissionRow(
  raw: Record<string, unknown>,
  tmplDef: unknown,
): Omit<InscriptionSubmissionAdminRow, "template_definition"> & {
  template_definition?: unknown;
} {
  const answers = (
    typeof raw.answers === "object" && raw.answers !== null ? raw.answers : {}
  ) as Record<string, unknown>;
  const files = (
    typeof raw.files === "object" && raw.files !== null ? raw.files : {}
  ) as SubmissionFilesMap;
  const { percent } = computeInscriptionProgress(tmplDef, answers, files);
  const portal = raw.portal_accounts as Record<string, unknown> | undefined;
  const tmpl = raw.inscription_templates as Record<string, unknown> | undefined;
  const candidate_nom = candidateAnswerField(raw, answers, "candidate_nom", "portal_ident_nom");
  const candidate_prenom = candidateAnswerField(raw, answers, "candidate_prenom", "portal_ident_prenom");
  const candidate_email = candidateAnswerField(raw, answers, "candidate_email", "portal_ident_email");
  const status = raw.status === "submitted" ? "submitted" : "draft";
  const rv = raw.admin_review_status;
  const adminReview =
    rv === "pending" ||
    rv === "accepted" ||
    rv === "rejected" ||
    rv === "needs_completion"
      ? rv
      : null;

  return {
    id: String(raw.id),
    portal_account_id: String(raw.portal_account_id),
    template_id: String(raw.template_id),
    formation_slug: String(raw.formation_slug ?? ""),
    ville_slug: String(raw.ville_slug ?? ""),
    status,
    answers,
    files,
    current_step_index: Number(raw.current_step_index ?? 0),
    progress_percent: Number(raw.progress_percent ?? 0),
    progress_computed_percent: percent,
    submitted_at: raw.submitted_at ? String(raw.submitted_at) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    admin_review_status: adminReview,
    reviewed_at: raw.reviewed_at ? String(raw.reviewed_at) : null,
    reviewer_note: raw.reviewer_note != null ? String(raw.reviewer_note) : null,
    reviewer_profile_id:
      raw.reviewer_profile_id != null ? String(raw.reviewer_profile_id) : null,
    admin_field_flags: parseAdminFieldFlags(raw.admin_field_flags),
    candidate_revision_notice:
      typeof raw.candidate_revision_notice === "string" && raw.candidate_revision_notice.trim()
        ? raw.candidate_revision_notice.trim()
        : null,
    candidate_nom,
    candidate_prenom,
    candidate_email,
    portal_email: portalPrimaryEmail(portal),
    portal_first_name:
      portal?.first_name != null ? String(portal.first_name) : null,
    portal_last_name:
      portal?.last_name != null ? String(portal.last_name) : null,
    template_title: tmpl?.title != null ? String(tmpl.title) : "",
    template_slug: tmpl?.slug != null ? String(tmpl.slug) : "",
    template_definition: tmplDef,
  };
}

export type InscriptionSubmissionReviewQuickPreset =
  | "backlog"
  | "waiting_candidate"
  | "accepted";

export type ListInscriptionSubmissionsParams = {
  page: number;
  pageSize: number;
  status?: SubmissionStatusPortal | "all";
  formationSlug?: string;
  villeSlug?: string;
  q?: string;
  sort: "updated_desc" | "updated_asc" | "submitted_desc";
  reviewStatus?: AdminReviewStatus | "all" | "none";
  /** Filtre rapide admin (dossiers envoyés uniquement), mutuellement exclusif avec `reviewStatus` détaillé côté appelant. */
  reviewQuickPreset?: InscriptionSubmissionReviewQuickPreset;
};

async function portalAccountIdsMatchingSearch(
  admin: import("@supabase/supabase-js").SupabaseClient,
  needle: string,
): Promise<string[] | null> {
  const trimmed = needle.trim();
  if (!trimmed) return null;
  const core = trimmed.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const pattern = `%${core}%`;
  const ids = new Set<string>();

  const { data: d1 } = await admin.from("portal_accounts").select("id").ilike("email", pattern);
  const { data: d2 } = await admin.from("portal_accounts").select("id").ilike("first_name", pattern);
  const { data: d3 } = await admin.from("portal_accounts").select("id").ilike("last_name", pattern);

  for (const row of [...(d1 ?? []), ...(d2 ?? []), ...(d3 ?? [])] as {
    id?: string | null;
  }[]) {
    const idKey = canonicalUuidLookupKey(row.id);
    if (idKey) ids.add(idKey);
  }

  return ids.size === 0 ? [] : [...ids];
}

function escIlike(needle: string): string {
  return needle.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

/**
 * Recherche sur l’identification : clés answers du portail (pas les colonnes dénormalisées),
 * pour rester compatible avec une base sans migrations « identité ».
 * (+ correspondance comptes portail si `portalIds` est fourni.)
 */
function orFilterForInscriptionTextSearch(needle: string, portalIds?: string[]): string {
  const p = `%${escIlike(needle)}%`;
  const parts = [
    `answers->>portal_ident_nom.ilike.${p}`,
    `answers->>portal_ident_prenom.ilike.${p}`,
    `answers->>portal_ident_email.ilike.${p}`,
  ];
  if (portalIds?.length) {
    parts.push(`portal_account_id.in.(${portalIds.join(",")})`);
  }
  return parts.join(",");
}

function trimSubmissionText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return s.length ? s : null;
}

function candidateAnswerField(
  row: Record<string, unknown>,
  answers: Record<string, unknown>,
  columnKey: string,
  answerFieldId: string,
): string | null {
  const fromDb = trimSubmissionText(row[columnKey]);
  if (fromDb) return fromDb;
  return trimSubmissionText(answers[answerFieldId]);
}

/**
 * Dossiers « Envoyés » encore à examiner par la direction (`pending` / pas encore de décision).
 * Aligné sur le préréglage « À traiter » des listes admin.
 */
export async function fetchInscriptionSubmissionsBacklogTotal(): Promise<number> {
  const admin = createAdminSupabase();
  if (!admin) return 0;

  const { count, error } = await admin
    .from("inscription_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "submitted")
    .or("admin_review_status.is.null,admin_review_status.eq.pending");

  if (error) {
    console.error(
      "[inscription_submissions] fetchInscriptionSubmissionsBacklogTotal:",
      error.message ?? error,
    );
    return 0;
  }
  return count ?? 0;
}

/** Compteurs tableau de bord (mêmes filtres que les listes hors filtre décisionnel). */
export async function fetchInscriptionSubmissionsDashboardStats(
  admin: import("@supabase/supabase-js").SupabaseClient,
  filters: InscriptionSubmissionListFilters,
): Promise<{
  total: number;
  backlog: number;
  waitingCandidate: number;
  accepted: number;
}> {
  let portalIdsFilter: string[] | undefined;
  if (filters.q?.trim()) {
    const ids = await portalAccountIdsMatchingSearch(admin, filters.q.trim());
    if (ids && ids.length > 0) portalIdsFilter = ids;
  }

  const filteredRoot = () =>
    admin
      .from("inscription_submissions")
      .select("id", { count: "exact", head: true });

  type HeadCountQuery = ReturnType<typeof filteredRoot>;

  function applySubmissionFilters(base: HeadCountQuery): HeadCountQuery {
    let q: HeadCountQuery = base;
    if (filters.status && filters.status !== "all") {
      q = q.eq("status", filters.status);
    }
    if (filters.formationSlug?.trim()) {
      q = q.eq("formation_slug", filters.formationSlug.trim());
    }
    if (filters.villeSlug?.trim()) {
      q = q.eq("ville_slug", filters.villeSlug.trim());
    }
    if (filters.q?.trim()) {
      q = q.or(orFilterForInscriptionTextSearch(filters.q.trim(), portalIdsFilter));
    }
    return q;
  }

  async function totalAll(): Promise<number> {
    const { count, error } = await applySubmissionFilters(filteredRoot());
    if (error) {
      console.error("[inscription_submissions] totalCount:", error);
      return 0;
    }
    return count ?? 0;
  }

  async function backlogCount(): Promise<number> {
    const qb = filteredRoot().eq("status", "submitted").or(
      "admin_review_status.is.null,admin_review_status.eq.pending",
    );
    const { count, error } = await applySubmissionFilters(qb);
    if (error) {
      console.error("[inscription_submissions] backlogCount:", error);
      return 0;
    }
    return count ?? 0;
  }

  async function waitCandidateCount(): Promise<number> {
    const qb = filteredRoot()
      .eq("status", "submitted")
      .eq("admin_review_status", "needs_completion");
    const { count, error } = await applySubmissionFilters(qb);
    if (error) {
      console.error("[inscription_submissions] waitCandidateCount:", error);
      return 0;
    }
    return count ?? 0;
  }

  async function acceptedCount(): Promise<number> {
    const qb = filteredRoot()
      .eq("status", "submitted")
      .eq("admin_review_status", "accepted");
    const { count, error } = await applySubmissionFilters(qb);
    if (error) {
      console.error("[inscription_submissions] acceptedCount:", error);
      return 0;
    }
    return count ?? 0;
  }

  const [total, backlog, waitingCandidate, accepted] = await Promise.all([
    totalAll(),
    backlogCount(),
    waitCandidateCount(),
    acceptedCount(),
  ]);

  return { total, backlog, waitingCandidate, accepted };
}

export async function listInscriptionSubmissionsAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  params: ListInscriptionSubmissionsParams,
): Promise<{ rows: InscriptionSubmissionAdminRow[]; total: number }> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let portalIdsFilter: string[] | undefined;
  if (params.q?.trim()) {
    const ids = await portalAccountIdsMatchingSearch(admin, params.q.trim());
    if (ids && ids.length > 0) portalIdsFilter = ids;
  }

  let q = admin
    .from("inscription_submissions")
    .select(SELECT_INSCRIPTION_SUBMISSION_ROW, { count: "exact" });

  if (params.reviewQuickPreset) {
    q = q.eq("status", "submitted");
  } else if (params.status && params.status !== "all") {
    q = q.eq("status", params.status);
  }
  if (params.formationSlug?.trim()) {
    q = q.eq("formation_slug", params.formationSlug.trim());
  }
  if (params.villeSlug?.trim()) {
    q = q.eq("ville_slug", params.villeSlug.trim());
  }
  if (params.q?.trim()) {
    q = q.or(orFilterForInscriptionTextSearch(params.q.trim(), portalIdsFilter));
  }
  if (params.reviewQuickPreset === "backlog") {
    q = q.or("admin_review_status.is.null,admin_review_status.eq.pending");
  } else if (params.reviewQuickPreset === "waiting_candidate") {
    q = q.eq("admin_review_status", "needs_completion");
  } else if (params.reviewQuickPreset === "accepted") {
    q = q.eq("admin_review_status", "accepted");
  } else if (params.reviewStatus && params.reviewStatus !== "all") {
    if (params.reviewStatus === "none") {
      q = q.is("admin_review_status", null);
    } else {
      q = q.eq("admin_review_status", params.reviewStatus);
    }
  }

  switch (params.sort) {
    case "updated_asc":
      q = q.order("updated_at", { ascending: true });
      break;
    case "submitted_desc":
      q = q.order("submitted_at", { ascending: false, nullsFirst: false });
      break;
    default:
      q = q.order("updated_at", { ascending: false });
      break;
  }

  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error || !Array.isArray(data)) {
    console.error("[inscription_submissions] listInscriptionSubmissionsAdmin:", error?.message ?? error);
    return { rows: [], total: count ?? 0 };
  }

  const rawRows = data as Record<string, unknown>[];
  const portalIds = rawRows.flatMap((r) => {
    const id = submissionPortalAccountId(r);
    return id ? [id] : [];
  });
  const templateIds = rawRows.flatMap((r) => {
    const id = submissionTemplateId(r);
    return id ? [id] : [];
  });

  const [portalMap, templateMap] = await Promise.all([
    loadPortalAccountsBriefMap(admin, portalIds),
    loadInscriptionTemplatesBriefMap(admin, templateIds),
  ]);

  const rows = rawRows.map((raw) =>
    finalizeAdminSubmissionRow(raw, portalMap, templateMap),
  );

  return { rows, total: count ?? rows.length };
}

export async function getInscriptionSubmissionAdminById(
  admin: import("@supabase/supabase-js").SupabaseClient,
  id: string,
): Promise<InscriptionSubmissionAdminRow | null> {
  if (!canonicalUuidLookupKey(id)) return null;
  const { data, error } = await admin
    .from("inscription_submissions")
    .select(SELECT_INSCRIPTION_SUBMISSION_ROW)
    .eq("id", id)
    .maybeSingle();

  if (error || !data || typeof data !== "object") {
    if (error) {
      console.error("[inscription_submissions] getInscriptionSubmissionAdminById:", error.message ?? error);
    }
    return null;
  }

  const raw = data as Record<string, unknown>;
  const pid = submissionPortalAccountId(raw);
  const tid = submissionTemplateId(raw);

  const [portalMap, templateMap] = await Promise.all([
    loadPortalAccountsBriefMap(admin, pid ? [pid] : []),
    loadInscriptionTemplatesBriefMap(admin, tid ? [tid] : []),
  ]);

  return finalizeAdminSubmissionRow(raw, portalMap, templateMap);
}

export async function updateSubmissionReviewAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  submissionId: string,
  reviewerProfileId: string,
  input: {
    admin_review_status: AdminReviewStatus;
    /** Si absent / `undefined`, la colonne `reviewer_note` n’est pas modifiée en base. */
    reviewer_note?: string | null | undefined;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canonicalUuidLookupKey(submissionId)) return { ok: false, error: "INVALID_ID" };
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    admin_review_status: input.admin_review_status,
    reviewed_at: now,
    reviewer_profile_id: reviewerProfileId,
    updated_at: now,
  };
  if (Object.prototype.hasOwnProperty.call(input, "reviewer_note")) {
    payload.reviewer_note = input.reviewer_note ?? null;
  }
  const { error } = await admin
    .from("inscription_submissions")
    .update(payload)
    .eq("id", submissionId);

  if (error) return { ok: false, error: error.message ?? "UPDATE_FAILED" };
  return { ok: true };
}

export async function reopenSubmissionToDraftAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  submissionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canonicalUuidLookupKey(submissionId)) return { ok: false, error: "INVALID_ID" };
  const now = new Date().toISOString();
  const { data: row } = await admin
    .from("inscription_submissions")
    .select("status")
    .eq("id", submissionId)
    .maybeSingle();
  const st = (row as { status?: string } | null)?.status;
  if (st !== "submitted") return { ok: false, error: "NOT_SUBMITTED" };

  const { error } = await admin
    .from("inscription_submissions")
    .update({
      status: "draft",
      submitted_at: null,
      admin_review_status: null,
      reviewed_at: null,
      reviewer_note: null,
      candidate_revision_notice: null,
      admin_field_flags: {},
      updated_at: now,
    })
    .eq("id", submissionId);

  if (error) return { ok: false, error: error.message ?? "UPDATE_FAILED" };
  return { ok: true };
}

/**
 * Conserve les drapeaux `admin_field_flags`, vide uniquement ces champs, enregistre un message global
 * (`candidate_revision_notice`), passe le dossier en `draft`, supprime les fichiers liés dans le bucket,
 * recalcule la progression. Fonctionne autant après un envoi `submitted` qu’après plusieurs allers-retours déjà en brouillon
 * tant qu’au moins une entrée existe dans les drapeaux.
 */
export async function requestCandidateModificationsAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  submissionId: string,
  input: {
    candidateRevisionNotice?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canonicalUuidLookupKey(submissionId)) return { ok: false, error: "INVALID_ID" };

  const { data, error } = await admin
    .from("inscription_submissions")
    .select("status, answers, files, admin_field_flags, template_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !data || typeof data !== "object") return { ok: false, error: "NOT_FOUND" };

  const rawRow = data as Record<string, unknown>;
  const stRaw = typeof rawRow.status === "string" ? rawRow.status.trim().toLowerCase() : "";
  const st =
    stRaw === "submitted" ? ("submitted" as const)
    : stRaw === "draft" ? ("draft" as const)
    : null;
  if (!st) return { ok: false, error: "BAD_STATUS" };

  const flagsObj =
    typeof rawRow.admin_field_flags === "object" &&
    rawRow.admin_field_flags !== null &&
    !Array.isArray(rawRow.admin_field_flags)
      ? ({
          ...(rawRow.admin_field_flags as Record<string, unknown>),
        } as Record<string, unknown>)
      : {};

  const fieldIds = Object.keys(flagsObj).map((k) => k.trim()).filter(Boolean);
  if (fieldIds.length === 0) return { ok: false, error: "NO_FIELD_FLAGS" };

  const tmplId =
    typeof rawRow.template_id === "string" && rawRow.template_id.trim()
      ? rawRow.template_id.trim()
      : "";
  let definition: unknown = {};
  if (tmplId) {
    const { data: tpl } = await admin
      .from("inscription_templates")
      .select("definition")
      .eq("id", tmplId)
      .maybeSingle();
    if (tpl && typeof tpl === "object" && "definition" in tpl) {
      definition = (tpl as { definition?: unknown }).definition ?? {};
    }
  }

  const answers = (
    typeof rawRow.answers === "object" && rawRow.answers !== null ? rawRow.answers : {}
  ) as Record<string, unknown>;
  const files = (
    typeof rawRow.files === "object" && rawRow.files !== null ? rawRow.files : {}
  ) as SubmissionFilesMap;

  const nextAnswers = { ...answers };
  const nextFiles = { ...files };
  const rmPaths = new Set<string>();

  for (const fid of fieldIds) {
    delete nextAnswers[fid];
    const pRaw = nextFiles[fid]?.path;
    const p = typeof pRaw === "string" ? pRaw.trim() : "";
    delete nextFiles[fid];
    if (p) rmPaths.add(p);
  }

  const { percent } = computeInscriptionProgress(definition, nextAnswers, nextFiles);

  const trimmed =
    typeof input.candidateRevisionNotice === "string"
      ? input.candidateRevisionNotice.trim() || null
      : null;

  const now = new Date().toISOString();

  const { error: updErr } = await admin
    .from("inscription_submissions")
    .update({
      status: "draft",
      submitted_at: null,
      answers: nextAnswers,
      files: nextFiles,
      progress_percent: percent,
      admin_field_flags: flagsObj,
      candidate_revision_notice: trimmed,
      admin_review_status: "needs_completion",
      reviewed_at: null,
      reviewer_note: null,
      reviewer_profile_id: null,
      updated_at: now,
    })
    .eq("id", submissionId);

  if (updErr) return { ok: false, error: updErr.message ?? "UPDATE_FAILED" };

  if (rmPaths.size > 0) {
    const { error: rmErr } = await admin.storage
      .from(INSCRIPTION_PUBLIC_UPLOAD_BUCKET_NAME)
      .remove([...rmPaths]);
    if (rmErr) {
      console.error(
        "[inscription_submissions] requestCandidateModifications storage:",
        rmErr.message ?? rmErr,
      );
    }
  }

  return { ok: true };
}

function collectSubmissionFileStoragePaths(files: SubmissionFilesMap): string[] {
  const out = new Set<string>();
  for (const meta of Object.values(files)) {
    const p = typeof meta?.path === "string" ? meta.path.trim() : "";
    if (p) out.add(p);
  }
  return [...out];
}

/** Limite par requête pour la suppression groupée (IDs distincts normalisés). */
const BULK_DELETE_ACCEPTED_MAX_IDS = 100;

export type BulkDeleteAcceptedInscriptionSubmissionsResult =
  | {
      ok: true;
      deleted: number;
      /** Demandés mais absents, ou présents mais pas « envoyés + acceptés ». */
      skippedNotEligible: number;
      /** Éligibles mais échec suppression (ex. contrainte SQL). */
      failed: number;
    }
  | { ok: false; error: string };

/**
 * Supprime plusieurs dossiers **uniquement** s’ils sont `status=submitted` et `admin_review_status=accepted`.
 * Réutilise `deleteInscriptionSubmissionAdmin` (fichiers stockage + ligne).
 */
export async function bulkDeleteAcceptedInscriptionSubmissionsAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  rawIds: string[],
): Promise<BulkDeleteAcceptedInscriptionSubmissionsResult> {
  const keys = uniqueCanonicalPortalIds(rawIds).slice(0, BULK_DELETE_ACCEPTED_MAX_IDS);
  if (!keys.length) return { ok: false, error: "NO_IDS" };

  const { data, error } = await admin
    .from("inscription_submissions")
    .select("id, status, admin_review_status")
    .in("id", keys);

  if (error) return { ok: false, error: error.message ?? "LOAD_FAILED" };

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const eligibleIds: string[] = [];
  for (const row of rows) {
    const id = canonicalUuidLookupKey(row.id);
    if (!id) continue;
    const st = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
    const rv = row.admin_review_status;
    if (st === "submitted" && rv === "accepted") eligibleIds.push(id);
  }

  const eligibleSet = new Set(eligibleIds);
  const skippedNotEligible = keys.filter((id) => !eligibleSet.has(id)).length;

  let deleted = 0;
  let failed = 0;
  for (const id of eligibleIds) {
    const res = await deleteInscriptionSubmissionAdmin(admin, id);
    if (res.ok) deleted += 1;
    else failed += 1;
  }

  return { ok: true, deleted, skippedNotEligible, failed };
}

/** Supprime le dossier en base après retrait best-effort des pièces du bucket public-uploads. */
export async function deleteInscriptionSubmissionAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  submissionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canonicalUuidLookupKey(submissionId)) return { ok: false, error: "INVALID_ID" };

  const { data, error } = await admin
    .from("inscription_submissions")
    .select("files")
    .eq("id", submissionId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message ?? "LOAD_FAILED" };
  if (!data || typeof data !== "object") return { ok: false, error: "NOT_FOUND" };

  const raw = data as { files?: unknown };
  const files = (
    typeof raw.files === "object" && raw.files !== null ? raw.files : {}
  ) as SubmissionFilesMap;

  const paths = collectSubmissionFileStoragePaths(files);
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage
      .from(INSCRIPTION_PUBLIC_UPLOAD_BUCKET_NAME)
      .remove(paths);
    if (rmErr) {
      console.error("[inscription_submissions] delete storage:", rmErr.message ?? rmErr);
    }
  }

  const { data: deletedRows, error: delErr } = await admin
    .from("inscription_submissions")
    .delete()
    .eq("id", submissionId)
    .select("id");

  if (delErr) return { ok: false, error: delErr.message ?? "DELETE_FAILED" };
  if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
    return { ok: false, error: "NOT_FOUND" };
  }

  return { ok: true };
}

export async function clearSubmissionFieldAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  submissionId: string,
  fieldId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fid = fieldId.trim();
  if (!canonicalUuidLookupKey(submissionId) || !fid) return { ok: false, error: "INVALID_PARAMS" };

  const { data, error } = await admin
    .from("inscription_submissions")
    .select("answers, files, template_id, admin_field_flags")
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !data || typeof data !== "object") {
    return { ok: false, error: "NOT_FOUND" };
  }

  const raw = data as Record<string, unknown>;
  const templateIdRaw = typeof raw.template_id === "string" ? raw.template_id : "";

  let definition: unknown;
  const tmplKey = canonicalUuidLookupKey(templateIdRaw);
  if (tmplKey) {
    const { data: trow } = await admin
      .from("inscription_templates")
      .select("definition")
      .eq("id", tmplKey)
      .maybeSingle();
    definition = (trow as { definition?: unknown } | null)?.definition;
  } else {
    definition = undefined;
  }

  const answers = (
    typeof raw.answers === "object" && raw.answers !== null ? raw.answers : {}
  ) as Record<string, unknown>;
  const files = (
    typeof raw.files === "object" && raw.files !== null ? raw.files : {}
  ) as SubmissionFilesMap;

  const flagsObj =
    typeof raw.admin_field_flags === "object" &&
    raw.admin_field_flags !== null &&
    !Array.isArray(raw.admin_field_flags)
      ? ({
          ...(raw.admin_field_flags as Record<string, unknown>),
        } as Record<string, unknown>)
      : {};
  delete flagsObj[fid];

  const storagePathRaw = files[fid]?.path;
  const storagePath =
    typeof storagePathRaw === "string" ? storagePathRaw.trim() : "";

  const nextAnswers = { ...answers };
  delete nextAnswers[fid];

  const nextFiles = { ...files };
  delete nextFiles[fid];

  const { percent } = computeInscriptionProgress(
    definition,
    nextAnswers,
    nextFiles as SubmissionFilesMap,
  );

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("inscription_submissions")
    .update({
      answers: nextAnswers,
      files: nextFiles,
      progress_percent: percent,
      admin_field_flags: flagsObj,
      updated_at: now,
    })
    .eq("id", submissionId);

  if (updErr) return { ok: false, error: updErr.message ?? "UPDATE_FAILED" };

  if (storagePath) {
    await admin.storage.from(INSCRIPTION_PUBLIC_UPLOAD_BUCKET_NAME).remove([storagePath]);
  }

  return { ok: true };
}

export async function updateSubmissionFieldReviewAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
  submissionId: string,
  fieldId: string,
  ok: boolean,
  message?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fid = fieldId.trim();
  if (!canonicalUuidLookupKey(submissionId) || !fid) return { ok: false, error: "INVALID_PARAMS" };

  const { data, error } = await admin
    .from("inscription_submissions")
    .select("admin_field_flags")
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !data || typeof data !== "object") return { ok: false, error: "NOT_FOUND" };

  const raw = data as Record<string, unknown>;
  const prev =
    typeof raw.admin_field_flags === "object" &&
    raw.admin_field_flags !== null &&
    !Array.isArray(raw.admin_field_flags)
      ? ({
          ...(raw.admin_field_flags as Record<string, unknown>),
        } as Record<string, unknown>)
      : {};

  if (ok) {
    delete prev[fid];
  } else {
    const trimmed = typeof message === "string" ? message.trim() : "";
    prev[fid] = trimmed ? ({ message: trimmed } as Record<string, unknown>) : ({} as Record<string, unknown>);
  }

  const now = new Date().toISOString();
  const { error: updErr } = await admin
    .from("inscription_submissions")
    .update({
      admin_field_flags: prev,
      updated_at: now,
    })
    .eq("id", submissionId);

  if (updErr) return { ok: false, error: updErr.message ?? "UPDATE_FAILED" };
  return { ok: true };
}

export async function fetchDistinctFormationSlugAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
): Promise<string[]> {
  const { data } = await admin
    .from("inscription_submissions")
    .select("formation_slug")
    .order("formation_slug", { ascending: true });
  if (!data?.length) return [];
  const s = new Set<string>();
  for (const row of data as { formation_slug?: string | null }[]) {
    const v = row.formation_slug?.trim();
    if (v) s.add(v);
  }
  return [...s];
}

export async function fetchDistinctVilleSlugAdmin(
  admin: import("@supabase/supabase-js").SupabaseClient,
): Promise<string[]> {
  const { data } = await admin
    .from("inscription_submissions")
    .select("ville_slug")
    .order("ville_slug", { ascending: true });
  if (!data?.length) return [];
  const s = new Set<string>();
  for (const row of data as { ville_slug?: string | null }[]) {
    const v = row.ville_slug?.trim();
    if (v) s.add(v);
  }
  return [...s];
}
