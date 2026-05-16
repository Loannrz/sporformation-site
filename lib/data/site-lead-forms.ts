import { createAdminSupabase } from "@/lib/supabase/admin";

/** Statuts persistant en base (formulaires vitrine). */
export type SiteLeadStatut = "nouveau" | "approuve" | "contacte";

export type SiteLeadStudentRow = {
  id: string;
  createdAt: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  villeResidence: string | null;
  formationSouhaitee: string;
  villeFormation: string | null;
  situation: string;
  employeurStructure: string;
  sourceConnaissance: string;
  motivation: string;
  consentementRecontact: boolean;
  consentementPolitique: boolean;
  origine: string;
  statut: SiteLeadStatut;
  contacteAt: string | null;
  approuveAt: string | null;
};

export type SiteLeadEmployerRow = {
  id: string;
  createdAt: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  formationRecherchee: string;
  rechercheAlternants: boolean;
  consentementRecontact: boolean;
  consentementPolitique: boolean;
  origine: string;
  statut: SiteLeadStatut;
  contacteAt: string | null;
  approuveAt: string | null;
};

export type SiteLeadTepRow = {
  id: string;
  createdAt: string;
  prenom: string;
  nom: string;
  dateNaissance: string | null;
  telephone: string;
  email: string;
  lieuResidence: string;
  pratiqueSport: string;
  pratiqueSportDetail: string | null;
  formationVisee: string;
  structureAlternance: string;
  dejaPasseTep: string;
  echecsTep: string[];
  disponibilites: string[];
  consentementRecontact: boolean;
  consentementPolitique: boolean;
  origine: string;
  statut: SiteLeadStatut;
  contacteAt: string | null;
  approuveAt: string | null;
};

function normalizeStatut(raw: string | null | undefined): SiteLeadStatut {
  if (raw === "approuve" || raw === "contacte") return raw;
  return "nouveau";
}

function mapStudent(row: Record<string, unknown>): SiteLeadStudentRow {
  return {
    id: String(row.id ?? ""),
    createdAt: String(row.created_at ?? ""),
    prenom: String(row.prenom ?? ""),
    nom: String(row.nom ?? ""),
    email: String(row.email ?? ""),
    telephone: String(row.telephone ?? ""),
    villeResidence:
      typeof row.ville_residence === "string" ? row.ville_residence : null,
    formationSouhaitee: String(row.formation_souhaitee ?? ""),
    villeFormation:
      typeof row.ville_formation === "string" ? row.ville_formation : null,
    situation: String(row.situation ?? ""),
    employeurStructure: String(row.employeur_structure ?? ""),
    sourceConnaissance: String(row.source_connaissance ?? ""),
    motivation: String(row.motivation ?? ""),
    consentementRecontact: Boolean(row.consentement_recontact),
    consentementPolitique: Boolean(row.consentement_politique),
    origine: String(row.origine ?? ""),
    statut: normalizeStatut(row.statut as string),
    contacteAt:
      typeof row.contacte_at === "string" ? row.contacte_at : null,
    approuveAt:
      typeof row.approuve_at === "string" ? row.approuve_at : null,
  };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : v == null ? "" : String(v)))
    .filter((v) => v.trim().length > 0);
}

function mapTep(row: Record<string, unknown>): SiteLeadTepRow {
  return {
    id: String(row.id ?? ""),
    createdAt: String(row.created_at ?? ""),
    prenom: String(row.prenom ?? ""),
    nom: String(row.nom ?? ""),
    dateNaissance:
      typeof row.date_naissance === "string" ? row.date_naissance : null,
    telephone: String(row.telephone ?? ""),
    email: String(row.email ?? ""),
    lieuResidence: String(row.lieu_residence ?? ""),
    pratiqueSport: String(row.pratique_sport ?? ""),
    pratiqueSportDetail:
      typeof row.pratique_sport_detail === "string"
        ? row.pratique_sport_detail
        : null,
    formationVisee: String(row.formation_visee ?? ""),
    structureAlternance: String(row.structure_alternance ?? ""),
    dejaPasseTep: String(row.deja_passe_tep ?? ""),
    echecsTep: stringArray(row.echecs_tep),
    disponibilites: stringArray(row.disponibilites),
    consentementRecontact: Boolean(row.consentement_recontact),
    consentementPolitique: Boolean(row.consentement_politique),
    origine: String(row.origine ?? ""),
    statut: normalizeStatut(row.statut as string),
    contacteAt:
      typeof row.contacte_at === "string" ? row.contacte_at : null,
    approuveAt:
      typeof row.approuve_at === "string" ? row.approuve_at : null,
  };
}

function mapEmployer(row: Record<string, unknown>): SiteLeadEmployerRow {
  return {
    id: String(row.id ?? ""),
    createdAt: String(row.created_at ?? ""),
    prenom: String(row.prenom ?? ""),
    nom: String(row.nom ?? ""),
    email: String(row.email ?? ""),
    telephone: String(row.telephone ?? ""),
    formationRecherchee: String(row.formation_recherchee ?? ""),
    rechercheAlternants: Boolean(row.recherche_alternants),
    consentementRecontact: Boolean(row.consentement_recontact),
    consentementPolitique: Boolean(row.consentement_politique),
    origine: String(row.origine ?? ""),
    statut: normalizeStatut(row.statut as string),
    contacteAt:
      typeof row.contacte_at === "string" ? row.contacte_at : null,
    approuveAt:
      typeof row.approuve_at === "string" ? row.approuve_at : null,
  };
}

export async function fetchSiteLeadStudents(): Promise<SiteLeadStudentRow[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin
    .from("formulaires_etudiants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapStudent);
}

export async function fetchSiteLeadEmployers(): Promise<SiteLeadEmployerRow[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin
    .from("formulaires_employeurs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapEmployer);
}

export async function fetchSiteLeadTeps(): Promise<SiteLeadTepRow[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin
    .from("reservations_prepa_tep")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as Record<string, unknown>[]).map(mapTep);
}

/** Demandes encore à traiter (badge hub admin). */
export async function fetchSiteLeadPendingTotal(): Promise<number> {
  const admin = createAdminSupabase();
  if (!admin) return 0;

  const [st, em, tep] = await Promise.all([
    admin
      .from("formulaires_etudiants")
      .select("id", { count: "exact", head: true })
      .eq("statut", "nouveau"),
    admin
      .from("formulaires_employeurs")
      .select("id", { count: "exact", head: true })
      .eq("statut", "nouveau"),
    admin
      .from("reservations_prepa_tep")
      .select("id", { count: "exact", head: true })
      .eq("statut", "nouveau"),
  ]);

  let n = 0;
  if (!st.error && st.count != null) n += st.count;
  if (!em.error && em.count != null) n += em.count;
  if (!tep.error && tep.count != null) n += tep.count;
  return n;
}
