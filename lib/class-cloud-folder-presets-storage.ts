import type { ClassCloudFolderTemplateNode } from "@/lib/class-cloud-folder-template";

export type StoredClassCloudFolderPreset = {
  id: string;
  label: string;
  roots: ClassCloudFolderTemplateNode[];
  savedAt: string;
};

const STORAGE_KEY = "sporformation:class-cloud-folder-presets:v1";

function isTemplateNode(x: unknown): x is ClassCloudFolderTemplateNode {
  if (!x || typeof x !== "object") return false;
  const o = x as { name?: unknown; children?: unknown };
  if (typeof o.name !== "string" || !o.name.trim()) return false;
  if (!Array.isArray(o.children)) return false;
  return o.children.every(isTemplateNode);
}

function isStoredPreset(x: unknown): x is StoredClassCloudFolderPreset {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.label !== "string") return false;
  if (typeof o.savedAt !== "string") return false;
  if (!Array.isArray(o.roots)) return false;
  return o.roots.every(isTemplateNode);
}

export function loadClassCloudFolderPresets(): StoredClassCloudFolderPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || !("presets" in data)) return [];
    const presets = (data as { presets: unknown }).presets;
    if (!Array.isArray(presets)) return [];
    return presets.filter(isStoredPreset);
  } catch {
    return [];
  }
}

function persist(presets: StoredClassCloudFolderPreset[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets }));
}

export function addClassCloudFolderPreset(
  label: string,
  roots: ClassCloudFolderTemplateNode[],
): StoredClassCloudFolderPreset {
  const trimmed = label.trim();
  const preset: StoredClassCloudFolderPreset = {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: trimmed || "Sans titre",
    roots,
    savedAt: new Date().toISOString(),
  };
  const list = loadClassCloudFolderPresets();
  persist([preset, ...list]);
  return preset;
}

export function removeClassCloudFolderPreset(id: string): void {
  const list = loadClassCloudFolderPresets().filter((p) => p.id !== id);
  persist(list);
}
