import type { ClassCloudFolderNode } from "@/lib/data/school";

/** Arborescence sans identifiants (export / réapplication sur une classe). */
export type ClassCloudFolderTemplateNode = {
  name: string;
  children: ClassCloudFolderTemplateNode[];
};

export function cloudFolderTreeToTemplateRoots(
  nodes: ClassCloudFolderNode[],
): ClassCloudFolderTemplateNode[] {
  return nodes
    .filter((n) => !n.isSystem)
    .map((n) => ({
      name: n.name.trim(),
      children: cloudFolderTreeToTemplateRoots(n.children),
    }))
    .filter((n) => n.name.length > 0);
}
