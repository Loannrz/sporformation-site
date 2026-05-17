/** Normalisation définition formulaire inscription (templates.definition JSONB). */

export type SubmissionFilesMap = Record<
  string,
  { path?: string | null; name?: string | null; mime?: string | null }
>;

const PRESENTATION_KINDS = new Set<string>([
  "heading",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "subtitle",
  "title",
  "page_title",
  "section_title",
  "sectionheading",
  "static",
  "plaintext",
  "html",
  "html_block",
  "divider",
  "separator",
  "spacer",
  "informational",
  "infoblock",
  "infotext",
  "helper",
  "helper_text",
  "eyebrow",
  "label_block",
  /** Texte / titres non saisissables */
  "description",
  "paragraph",
  "caption",
  "legend",
  "quote",
  "blockquote",
  "richtext",
  "rich_text",
  "markdown",
  "md",
  "callout",
  "alert",
  "notice",
  "announcement",
  "banner",
  "content",
  "intro",
  "outro",
  "body",
  "label",
  "embed",
  "iframe",
  "video",
  "audio",
]);

/**
 * `type` / `kind`… normalisés (minuscule, `_` au lieu de `-`).
 */
export function normalizedTemplateFieldKind(o: Record<string, unknown>): string | null {
  for (const key of ["type", "kind", "component", "fieldType", "widget"] as const) {
    const v = o[key];
    if (typeof v !== "string") continue;
    const s = v.trim().toLowerCase();
    if (!s) continue;
    return s.replace(/-/g, "_");
  }
  return null;
}

/**
 * Feuille de définition qui n’est pas une saisie (titre / texte d’aide / séparateur, etc.).
 * Les champs hors liste avec `presentation` / `displayOnly` peuvent être exclus aussi.
 */
export function isPresentationOnlyTemplateLeaf(o: Record<string, unknown>): boolean {
  const nestBlocks = o.blocks;
  const nestFields = o.fields;
  if (Array.isArray(nestBlocks) && nestBlocks.length > 0) return false;
  if (Array.isArray(nestFields) && nestFields.length > 0) return false;

  if (o.presentation === true || o.displayOnly === true) return true;
  if (typeof o.role === "string" && o.role.trim().toLowerCase() === "presentation") return true;

  const k = normalizedTemplateFieldKind(o);
  if (!k) return false;
  if (PRESENTATION_KINDS.has(k)) return true;
  return k.endsWith("_static") || k.startsWith("static_");
}

/** Types de widgets qui collectent une réponse / fichier (affichage admin : garder la ligne même si vide). */
const USER_INPUT_TEMPLATE_KINDS = new Set<string>([
  "text",
  "textarea",
  "email",
  "tel",
  "phone",
  "url",
  "search",
  "password",
  "number",
  "integer",
  "decimal",
  "float",
  "currency",
  "percent",
  "date",
  "datetime",
  "datetime_local",
  "time",
  "month",
  "week",
  "year",
  "select",
  "multiselect",
  "dropdown",
  "combobox",
  "radio",
  "checkbox",
  "switch",
  "toggle",
  "boolean",
  "yes_no",
  "file",
  "upload",
  "attachment",
  "pdf",
  "signature",
  "address",
  "fullname",
  "name",
  "image",
]);

/**
 * Feuille correspondant à une vraie question / pièce attendue du candidat.
 * Les blocs vides non reconnus ici sont masqués côté admin (titres, descriptions, etc.).
 */
export function isTemplateLeafCollectingUserInput(o: Record<string, unknown>): boolean {
  if (isPresentationOnlyTemplateLeaf(o)) return false;
  if (o.required === true) return true;
  const k = normalizedTemplateFieldKind(o);
  if (!k) return false;
  if (USER_INPUT_TEMPLATE_KINDS.has(k)) return true;
  return false;
}

function collectLeafFieldIdsFromNode(node: unknown, into: Set<string>): void {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  const blocks = Array.isArray(n.blocks) ? n.blocks : [];
  const fields = Array.isArray(n.fields) ? n.fields : [];
  const hasNest = blocks.length > 0 || fields.length > 0;
  if (hasNest) {
    for (const b of blocks) collectLeafFieldIdsFromNode(b, into);
    for (const f of fields) collectLeafFieldIdsFromNode(f, into);
    return;
  }
  const id = typeof n.id === "string" ? n.id.trim() : "";
  if (id && !isPresentationOnlyTemplateLeaf(n)) into.add(id);
}

/** IDs des champs saisissables (hors titres / blocs présentation). */
export function collectLeafInputFieldIdsFromDefinition(definition: unknown): Set<string> {
  const ids = new Set<string>();
  if (!definition || typeof definition !== "object") return ids;
  const steps = (definition as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return ids;
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const s = step as { blocks?: unknown[]; fields?: unknown[] };
    for (const b of s.blocks ?? []) collectLeafFieldIdsFromNode(b, ids);
    for (const f of s.fields ?? []) collectLeafFieldIdsFromNode(f, ids);
  }
  return ids;
}

function isNonEmptyAnswer(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return false;
}

function walkFields(
  fields: unknown[] | undefined,
  out: { id: string; required: boolean }[],
): void {
  if (!Array.isArray(fields)) return;
  for (const f of fields) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) continue;
    const nestFields = o.fields;
    const nestBlocks = o.blocks;
    if (Array.isArray(nestFields) || Array.isArray(nestBlocks)) {
      if (Array.isArray(nestFields)) walkFields(nestFields, out);
      if (Array.isArray(nestBlocks)) walkBlocks(nestBlocks as unknown[], out);
      continue;
    }
    if (isPresentationOnlyTemplateLeaf(o)) continue;
    out.push({ id, required: o.required === true });
  }
}

function walkBlocks(blocks: unknown[] | undefined, out: { id: string; required: boolean }[]): void {
  if (!Array.isArray(blocks)) return;
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const nestBlocks = o.blocks;
    const nestFields = o.fields;
    if (Array.isArray(nestBlocks) || Array.isArray(nestFields)) {
      walkBlocks(Array.isArray(nestBlocks) ? nestBlocks : undefined, out);
      walkFields(Array.isArray(nestFields) ? nestFields : undefined, out);
      continue;
    }
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) continue;
    if (isPresentationOnlyTemplateLeaf(o)) continue;
    out.push({ id, required: o.required === true });
  }
}

/**
 * Structure attendue : `{ steps: [{ blocks?: [...], fields?: [...] }] }`.
 * Réponses / fichiers : `answers[fieldId]`, `files[fieldId].path`.
 */
export function collectTemplateFields(definition: unknown): { id: string; required: boolean }[] {
  const out: { id: string; required: boolean }[] = [];
  if (!definition || typeof definition !== "object") return out;

  const steps = (definition as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return out;

  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const s = step as { blocks?: unknown[]; fields?: unknown[] };
    walkBlocks(Array.isArray(s.blocks) ? s.blocks : undefined, out);
    walkFields(Array.isArray(s.fields) ? s.fields : undefined, out);
  }

  const byId = new Map<string, boolean>();
  for (const { id, required } of out) {
    byId.set(id, byId.get(id) === true || required);
  }
  return [...byId.entries()].map(([id, required]) => ({ id, required }));
}

function leafDisplayLabel(o: Record<string, unknown>): string {
  const raw = o.label ?? o.title ?? o.name;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const id = typeof o.id === "string" ? o.id.trim() : "";
  return id || "—";
}

function walkFieldsLabels(
  fields: unknown[] | undefined,
  map: Map<string, string>,
): void {
  if (!Array.isArray(fields)) return;
  for (const f of fields) {
    if (!f || typeof f !== "object") continue;
    const o = f as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const nestFields = o.fields;
    const nestBlocks = o.blocks;
    if (Array.isArray(nestFields) || Array.isArray(nestBlocks)) {
      if (Array.isArray(nestFields)) walkFieldsLabels(nestFields, map);
      if (Array.isArray(nestBlocks)) walkBlocksLabels(nestBlocks as unknown[], map);
      continue;
    }
    if (!id || isPresentationOnlyTemplateLeaf(o)) continue;
    map.set(id, leafDisplayLabel(o));
  }
}

function walkBlocksLabels(blocks: unknown[] | undefined, map: Map<string, string>): void {
  if (!Array.isArray(blocks)) return;
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const nestBlocks = o.blocks;
    const nestFields = o.fields;
    if (Array.isArray(nestBlocks) || Array.isArray(nestFields)) {
      walkBlocksLabels(Array.isArray(nestBlocks) ? nestBlocks : undefined, map);
      walkFieldsLabels(Array.isArray(nestFields) ? nestFields : undefined, map);
      continue;
    }
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id || isPresentationOnlyTemplateLeaf(o)) continue;
    map.set(id, leafDisplayLabel(o));
  }
}

/** Pour chaque id de champ « feuille » du gabarit, libellé affichable (label / title / id). */
export function buildTemplateFieldLabelMap(definition: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!definition || typeof definition !== "object") return map;
  const steps = (definition as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return map;
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const s = step as { blocks?: unknown[]; fields?: unknown[] };
    walkBlocksLabels(Array.isArray(s.blocks) ? s.blocks : undefined, map);
    walkFieldsLabels(Array.isArray(s.fields) ? s.fields : undefined, map);
  }
  return map;
}

export function requiredFieldIds(definition: unknown): string[] {
  return collectTemplateFields(definition).filter((f) => f.required).map((f) => f.id);
}

function fieldSatisfied(
  fieldId: string,
  answers: Record<string, unknown>,
  files: SubmissionFilesMap,
): boolean {
  const fileEntry = files[fieldId];
  if (fileEntry?.path != null && String(fileEntry.path).trim() !== "")
    return true;
  return isNonEmptyAnswer(answers[fieldId]);
}

export function computeInscriptionProgress(
  definition: unknown,
  answers: Record<string, unknown> | null | undefined,
  files: SubmissionFilesMap | null | undefined,
): { percent: number; filled: number; total: number } {
  const req = requiredFieldIds(definition);
  const a = answers ?? {};
  const f = files ?? {};

  const total = req.length;
  if (total === 0) return { percent: 100, filled: 0, total: 0 };

  let filled = 0;
  for (const id of req) {
    if (fieldSatisfied(id, a, f)) filled += 1;
  }
  const percent = Math.round((filled / total) * 100);
  return { percent, filled, total };
}
