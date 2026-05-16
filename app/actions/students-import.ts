"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import type { AppLocale } from "@/i18n/routing";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { canAccessStudentAdministration } from "@/lib/pedago-access";
import { actorFromSession, logActivity } from "@/lib/data/activity-logs";
import {
  STUDENT_EXTENDED_COLUMNS,
  STUDENT_FULL_SELECT,
  STUDENT_BASE_SELECT,
  buildExtendedPatch,
  cleanExtendedValue,
  type StudentExtendedColumn,
} from "@/lib/students-extended-fields";
import {
  isMissingStudentsIdentityColumnError,
  isMissingStudentsExtendedColumnError,
  extractMissingExtendedColumnName,
} from "@/lib/supabase/students-columns";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ */
/* Types partagés client/serveur                                       */
/* ------------------------------------------------------------------ */

export type ImportCandidate = {
  /** Index 0-based de la ligne dans la feuille (utile pour l’UI). */
  rowIndex: number;
  firstName: string;
  lastName: string;
  email: string | null;
  birthDate: string | null; // YYYY-MM-DD
  sex: string | null; // M / F / X / null
  birthPlace: string | null;
  extended: Partial<Record<StudentExtendedColumn, string | null>>;
};

export type ImportConflict = {
  candidate: ImportCandidate;
  /** Élève existant dans la même classe (clé NJS ou nom+prénom). */
  existing: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    birthDate: string | null;
    sex: string | null;
    birthPlace: string | null;
    njs: string | null;
  };
  /** Raison(s) pour lesquelles c’est un doublon. */
  reasons: Array<"NAME" | "NJS">;
};

export type ParseResult =
  | {
      ok: true;
      classId: string;
      totalRows: number;
      candidates: ImportCandidate[];
      conflicts: ImportConflict[];
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

export type ConflictResolution = "KEEP_EXISTING" | "REPLACE";

export type CommitInput = {
  classId: string;
  candidates: ImportCandidate[];
  /** Résolution clé = rowIndex (en string), valeur = stratégie. */
  resolutions: Record<string, ConflictResolution>;
  /** Pour chaque conflit, l’id existant à rapprocher du rowIndex. */
  conflictExistingIds: Record<string, string>;
};

export type CommitResult =
  | {
      ok: true;
      created: number;
      updated: number;
      skipped: number;
    }
  | {
      ok: false;
      error: string;
    };

/* ------------------------------------------------------------------ */
/* Utils parsing                                                       */
/* ------------------------------------------------------------------ */

const HEADER_ALIASES: Record<string, string[]> = {
  promo: ["promo"],
  ofName: ["nom de l'of", "nom de l of", "nom of"],
  formationNumber: ["numero de la formation", "numéro de la formation"],
  diploma: ["diplome", "diplôme"],
  tep: ["tep"],
  njs: ["njs", "n njs"],
  sex: ["sexe", "sex"],
  lastName: ["nom"],
  firstName: ["prenom", "prénom"],
  birthDate: ["date de naissance"],
  birthPlace: ["ville de naissance", "lieu de naissance"],
  birthCountry: ["pays de naissance"],
  birthDepartment: ["departement de naissance", "département de naissance"],
  phone: ["telephone", "téléphone", "tel"],
  addressLine1: ["adresse1", "adresse 1", "adresse"],
  addressLine2: ["adresse2", "adresse 2", "complement adresse"],
  postalCode: ["code postal", "cp"],
  addressCity: ["ville"],
  addressCountry: ["pays"],
  email: ["courriel", "email", "e-mail", "mail"],
  employmentStatus: ["status d'emploi", "statut d'emploi", "status d emploi"],
  parcoursup: ["entree parcoursup", "entrée parcoursup", "parcoursup"],
  validationStatus: ["etat de validation", "état de validation"],
  uc1Status: ["bc1/uc1", "bc1 uc1", "uc1", "bc1"],
  uc2Status: ["bc2/uc2", "bc2 uc2", "uc2", "bc2"],
  uc3Status: ["bc3/uc3", "bc3 uc3", "uc3", "bc3"],
  uc4Status: ["bc4/uc4", "bc4 uc4", "uc4", "bc4"],
};

type LogicalKey = keyof typeof HEADER_ALIASES;

function normalizeHeader(h: string): string {
  return h
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildHeaderMap(row: unknown[]): Map<LogicalKey, number> {
  const map = new Map<LogicalKey, number>();
  for (let i = 0; i < row.length; i++) {
    const raw = row[i];
    if (raw == null) continue;
    const h = normalizeHeader(String(raw));
    for (const key of Object.keys(HEADER_ALIASES) as LogicalKey[]) {
      if (HEADER_ALIASES[key].includes(h) && !map.has(key)) {
        map.set(key, i);
        break;
      }
    }
  }
  return map;
}

function normalizeSexFromXlsx(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw)
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (!s) return null;
  if (s === "homme" || s === "h" || s === "m" || s === "male" || s === "masculin")
    return "M";
  if (s === "femme" || s === "f" || s === "female" || s === "feminin")
    return "F";
  if (s === "autre" || s === "x" || s === "other") return "X";
  return null;
}

function normalizeBirthDate(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (!s) return null;
  // JJ/MM/AAAA
  let mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (mt) {
    const dd = mt[1].padStart(2, "0");
    const mm = mt[2].padStart(2, "0");
    return `${mt[3]}-${mm}-${dd}`;
  }
  // YYYY-MM-DD
  mt = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (mt) {
    const mm = mt[2].padStart(2, "0");
    const dd = mt[3].padStart(2, "0");
    return `${mt[1]}-${mm}-${dd}`;
  }
  // JJ-MM-AAAA
  mt = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (mt) {
    const dd = mt[1].padStart(2, "0");
    const mm = mt[2].padStart(2, "0");
    return `${mt[3]}-${mm}-${dd}`;
  }
  return null;
}

function stringOrNull(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s ? s : null;
}

function nameKey(first: string, last: string): string {
  return `${last}|${first}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Gardes                                                              */
/* ------------------------------------------------------------------ */

async function requireStaffAdmin() {
  const user = await getSessionUser();
  if (!user || !canAccessStudentAdministration(user)) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }
  return { ok: true as const, user };
}

/* ------------------------------------------------------------------ */
/* parseStudentsXlsxAction                                             */
/* ------------------------------------------------------------------ */

export async function parseStudentsXlsxAction(
  formData: FormData,
): Promise<ParseResult> {
  const gate = await requireStaffAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const classId = String(formData.get("classId") ?? "").trim();
  const file = formData.get("file");
  if (!classId) return { ok: false, error: "CLASS_REQUIRED" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "FILE_REQUIRED" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "FILE_TOO_LARGE" };
  }

  // Vérifier que la classe existe
  const { data: clsRow, error: clsErr } = await admin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle();
  if (clsErr || !clsRow) return { ok: false, error: "CLASS_NOT_FOUND" };

  let workbook: XLSX.WorkBook;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch (_e) {
    return { ok: false, error: "PARSE_FAILED" };
  }

  // Choisir feuille "Liste promo" si présente, sinon la 1re.
  const preferred = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes("liste"),
  );
  const sheetName = preferred ?? workbook.SheetNames[0];
  if (!sheetName) return { ok: false, error: "EMPTY_WORKBOOK" };
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  if (rows.length < 2) return { ok: false, error: "EMPTY_SHEET" };

  // Détection de la ligne d'en-tête (1re ligne avec ≥3 colonnes reconnues).
  let headerRowIdx = 0;
  let headerMap = buildHeaderMap(rows[0]);
  if (headerMap.size < 3) {
    for (let i = 1; i < Math.min(10, rows.length); i++) {
      const m = buildHeaderMap(rows[i]);
      if (m.size >= 3) {
        headerRowIdx = i;
        headerMap = m;
        break;
      }
    }
  }
  if (!headerMap.has("firstName") || !headerMap.has("lastName")) {
    return { ok: false, error: "MISSING_NAME_COLUMNS" };
  }

  const warnings: string[] = [];
  const candidates: ImportCandidate[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (key: LogicalKey): unknown => {
      const idx = headerMap.get(key);
      return idx == null ? null : r[idx];
    };

    const firstName = stringOrNull(get("firstName"));
    const lastName = stringOrNull(get("lastName"));
    if (!firstName || !lastName) continue; // Ligne sans nom → ignorée silencieusement

    const candidate: ImportCandidate = {
      rowIndex: i,
      firstName,
      lastName,
      email: stringOrNull(get("email"))?.toLowerCase() ?? null,
      birthDate: normalizeBirthDate(get("birthDate")),
      sex: normalizeSexFromXlsx(get("sex")),
      birthPlace: stringOrNull(get("birthPlace")),
      extended: {
        njs: stringOrNull(get("njs")),
        promo: stringOrNull(get("promo")),
        of_name: stringOrNull(get("ofName")),
        formation_number: stringOrNull(get("formationNumber")),
        diploma: stringOrNull(get("diploma")),
        tep: stringOrNull(get("tep")),
        birth_country: stringOrNull(get("birthCountry")),
        birth_department: stringOrNull(get("birthDepartment")),
        phone: stringOrNull(get("phone")),
        address_line1: stringOrNull(get("addressLine1")),
        address_line2: stringOrNull(get("addressLine2")),
        postal_code: stringOrNull(get("postalCode")),
        address_city: stringOrNull(get("addressCity")),
        address_country: stringOrNull(get("addressCountry")),
        employment_status: stringOrNull(get("employmentStatus")),
        parcoursup: stringOrNull(get("parcoursup")),
        validation_status: stringOrNull(get("validationStatus")),
        uc1_status: stringOrNull(get("uc1Status")),
        uc2_status: stringOrNull(get("uc2Status")),
        uc3_status: stringOrNull(get("uc3Status")),
        uc4_status: stringOrNull(get("uc4Status")),
      },
    };

    // Date mal formée → warning mais on continue
    const rawBirth = get("birthDate");
    if (rawBirth != null && candidate.birthDate == null) {
      warnings.push(
        `Ligne ${i + 1} : date de naissance ignorée (format inattendu : "${String(rawBirth)}").`,
      );
    }

    candidates.push(candidate);
  }

  // Chargement des élèves existants de la classe pour détecter les doublons.
  const existingRows = await loadExistingForClass(admin, classId);

  const byName = new Map<string, (typeof existingRows)[number]>();
  const byNjs = new Map<string, (typeof existingRows)[number]>();
  for (const e of existingRows) {
    byName.set(nameKey(e.first_name, e.last_name), e);
    if (e.njs) byNjs.set(e.njs.toLowerCase(), e);
  }

  const conflicts: ImportConflict[] = [];
  for (const c of candidates) {
    const k = nameKey(c.firstName, c.lastName);
    const njsVal = c.extended.njs ? c.extended.njs.toLowerCase() : null;
    const eByName = byName.get(k) ?? null;
    const eByNjs = njsVal ? byNjs.get(njsVal) ?? null : null;
    const existing = eByNjs ?? eByName;
    if (!existing) continue;

    const reasons: Array<"NAME" | "NJS"> = [];
    if (eByName?.id === existing.id) reasons.push("NAME");
    if (eByNjs?.id === existing.id) reasons.push("NJS");

    conflicts.push({
      candidate: c,
      existing: {
        id: existing.id,
        firstName: existing.first_name,
        lastName: existing.last_name,
        email: existing.email,
        birthDate: (existing.birth_date as string | null) ?? null,
        sex: (existing.sex as string | null) ?? null,
        birthPlace: (existing.birth_place as string | null) ?? null,
        njs: (existing.njs as string | null) ?? null,
      },
      reasons: reasons.length ? reasons : ["NAME"],
    });
  }

  return {
    ok: true,
    classId,
    totalRows: candidates.length,
    candidates,
    conflicts,
    warnings,
  };
}

type ExistingRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  birth_date: string | null;
  sex: string | null;
  birth_place: string | null;
  njs: string | null;
};

async function loadExistingForClass(
  admin: SupabaseClient,
  classId: string,
): Promise<ExistingRow[]> {
  const tries = [STUDENT_FULL_SELECT, STUDENT_BASE_SELECT];
  for (const sel of tries) {
    const { data, error } = await admin
      .from("students")
      .select(sel)
      .eq("class_id", classId);
    if (!error && data) {
      return (data as unknown as Array<Record<string, unknown>>).map((r) => ({
        id: String(r.id),
        first_name: String(r.first_name),
        last_name: String(r.last_name),
        email: (r.email as string | null) ?? null,
        birth_date: (r.birth_date as string | null) ?? null,
        sex: (r.sex as string | null) ?? null,
        birth_place: (r.birth_place as string | null) ?? null,
        njs: (r.njs as string | null) ?? null,
      }));
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* commitStudentsXlsxImportAction                                      */
/* ------------------------------------------------------------------ */

function stripExtendedColumns(
  row: Record<string, unknown>,
  cols: StudentExtendedColumn[],
): Record<string, unknown> {
  const out = { ...row };
  for (const c of cols) {
    if (c in out) delete out[c];
  }
  return out;
}

async function insertWithFallback(
  admin: SupabaseClient,
  base: Record<string, unknown>,
) {
  let row = { ...base };
  let attempt = await admin.from("students").insert(row).select("id").single();
  while (attempt.error) {
    const e = attempt.error;
    if (isMissingStudentsIdentityColumnError(e) && "birth_date" in row) {
      const {
        birth_date: _bd,
        sex: _sx,
        birth_place: _bp,
        ...rest
      } = row as Record<string, unknown>;
      row = rest;
      attempt = await admin
        .from("students")
        .insert(row)
        .select("id")
        .single();
      continue;
    }
    if (isMissingStudentsExtendedColumnError(e)) {
      const missing = extractMissingExtendedColumnName(e);
      if (missing) {
        row = stripExtendedColumns(row, [missing as StudentExtendedColumn]);
      } else {
        row = stripExtendedColumns(row, [...STUDENT_EXTENDED_COLUMNS]);
      }
      attempt = await admin
        .from("students")
        .insert(row)
        .select("id")
        .single();
      continue;
    }
    break;
  }
  return attempt;
}

async function updateWithFallback(
  admin: SupabaseClient,
  studentId: string,
  patch: Record<string, unknown>,
) {
  let row = { ...patch };
  let attempt = await admin.from("students").update(row).eq("id", studentId);
  while (attempt.error) {
    const e = attempt.error;
    if (isMissingStudentsIdentityColumnError(e) && "birth_date" in row) {
      const {
        birth_date: _bd,
        sex: _sx,
        birth_place: _bp,
        ...rest
      } = row as Record<string, unknown>;
      row = rest;
      attempt = await admin
        .from("students")
        .update(row)
        .eq("id", studentId);
      continue;
    }
    if (isMissingStudentsExtendedColumnError(e)) {
      const missing = extractMissingExtendedColumnName(e);
      if (missing) {
        row = stripExtendedColumns(row, [missing as StudentExtendedColumn]);
      } else {
        row = stripExtendedColumns(row, [...STUDENT_EXTENDED_COLUMNS]);
      }
      attempt = await admin
        .from("students")
        .update(row)
        .eq("id", studentId);
      continue;
    }
    break;
  }
  return attempt;
}

function candidateToDbRow(
  c: ImportCandidate,
  classId: string,
): Record<string, unknown> {
  const ext = buildExtendedPatch(c.extended ?? {});
  return {
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email ? c.email.toLowerCase() : null,
    class_id: classId,
    birth_date: c.birthDate,
    sex: c.sex,
    birth_place: cleanExtendedValue(c.birthPlace),
    ...ext,
  };
}

export async function commitStudentsXlsxImportAction(
  locale: AppLocale,
  input: CommitInput,
): Promise<CommitResult> {
  const gate = await requireStaffAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "NO_SERVICE_ROLE" };

  const classId = String(input.classId ?? "").trim();
  if (!classId) return { ok: false, error: "CLASS_REQUIRED" };

  const { data: clsRow, error: clsErr } = await admin
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle();
  if (clsErr || !clsRow) return { ok: false, error: "CLASS_NOT_FOUND" };

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const c of input.candidates) {
    if (!c.firstName.trim() || !c.lastName.trim()) {
      skipped += 1;
      continue;
    }
    const key = String(c.rowIndex);
    const resolution = input.resolutions[key];

    if (resolution) {
      const existingId = input.conflictExistingIds[key];
      if (!existingId) {
        skipped += 1;
        continue;
      }
      if (resolution === "KEEP_EXISTING") {
        skipped += 1;
        continue;
      }
      if (resolution === "REPLACE") {
        const patch = candidateToDbRow(c, classId);
        const r = await updateWithFallback(admin, existingId, patch);
        if (r.error) {
          skipped += 1;
        } else {
          updated += 1;
        }
        continue;
      }
    }

    const row = candidateToDbRow(c, classId);
    const r = await insertWithFallback(admin, row);
    if (r.error || !r.data) {
      skipped += 1;
    } else {
      created += 1;
    }
  }

  if (created > 0 || updated > 0) {
    await logActivity({
      ...actorFromSession(gate.user),
      action: "STUDENTS_IMPORTED",
      entityType: "class",
      entityId: classId,
      meta: { created, updated, skipped },
    });
  }

  revalidatePath(`/${locale}/admin/students`);
  revalidatePath(`/${locale}/admin/classes/${classId}`);
  revalidatePath(`/${locale}/classes/${classId}`);

  return { ok: true, created, updated, skipped };
}
