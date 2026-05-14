"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Folder,
  FolderTree,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createClassCloudFolderAction,
  deleteClassCloudFolderAction,
  renameClassCloudFolderAction,
  reorderClassCloudFoldersAction,
} from "@/app/actions/class-cloud-folders";
import { ClassCloudFolderPresetButtons } from "@/components/admin/class-cloud-folder-preset-buttons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ClassCloudFolderNode } from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function reorderChildrenInTree(
  nodes: ClassCloudFolderNode[],
  parentKey: string | null,
  activeId: string,
  overId: string,
): ClassCloudFolderNode[] {
  if (parentKey === null) {
    return arrayMoveById(nodes, activeId, overId);
  }
  return nodes.map((n) => {
    if (n.id === parentKey) {
      return {
        ...n,
        children: arrayMoveById(n.children, activeId, overId),
      };
    }
    return {
      ...n,
      children: reorderChildrenInTree(
        n.children,
        parentKey,
        activeId,
        overId,
      ),
    };
  });
}

function arrayMoveById(
  list: ClassCloudFolderNode[],
  activeId: string,
  overId: string,
): ClassCloudFolderNode[] {
  const oldIndex = list.findIndex((x) => x.id === activeId);
  const newIndex = list.findIndex((x) => x.id === overId);
  if (oldIndex < 0 || newIndex < 0) return list;
  return arrayMove(list, oldIndex, newIndex);
}

type Props = {
  locale: AppLocale;
  classId: string;
  initialTree: ClassCloudFolderNode[];
};

export function ClassCloudFoldersPanel({ locale, classId, initialTree }: Props) {
  const router = useRouter();
  const [tree, setTree] = useState(initialTree);
  const [pending, startTransition] = useTransition();
  const t = useTranslations("admin.classManage.cloudFolders");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    setTree(initialTree);
  }, [initialTree]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const parentKey = (active.data.current?.parentKey ?? null) as string | null;
    const overParent = (over.data.current?.parentKey ?? null) as string | null;
    if (parentKey !== overParent) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const snapshot = tree;
    const next = reorderChildrenInTree(tree, parentKey, activeId, overId);
    setTree(next);

    const siblingIds = collectSiblingIds(next, parentKey);
    if (!siblingIds.length) {
      setTree(snapshot);
      return;
    }
    startTransition(async () => {
      const res = await reorderClassCloudFoldersAction(locale, {
        classId,
        parentId: parentKey,
        orderedIds: siblingIds,
      });
      if (!res.ok) {
        setTree(snapshot);
        toast.error(t("errors.generic"));
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-sky-500/[0.06] via-muted/25 to-muted/10 p-4 shadow-sm dark:from-sky-400/10 dark:via-muted/15 dark:to-muted/5 sm:p-5">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-sky-400/15 blur-2xl dark:bg-sky-400/20"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/90 shadow-sm ring-1 ring-border/60 dark:bg-card">
              <FolderTree className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold">{t("heading")}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("hint")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <ClassCloudFolderPresetButtons
              locale={locale}
              classId={classId}
              tree={tree}
            />
            <AddRootFolderButton
              locale={locale}
              classId={classId}
              onCreated={() => router.refresh()}
            />
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/15 px-6 py-14 text-center dark:bg-muted/10">
            <Folder className="mb-3 h-11 w-11 text-muted-foreground/55" aria-hidden />
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("empty")}
            </p>
          </div>
        ) : (
          <FolderBranch
            locale={locale}
            classId={classId}
            nodes={tree}
            parentKey={null}
            pending={pending}
            onRefresh={() => router.refresh()}
          />
        )}
      </DndContext>
    </div>
  );
}

function collectSiblingIds(
  nodes: ClassCloudFolderNode[],
  parentKey: string | null,
): string[] {
  if (parentKey === null) {
    return nodes.map((n) => n.id);
  }
  const parent = findNode(nodes, parentKey);
  return parent ? parent.children.map((c) => c.id) : [];
}

function findNode(
  nodes: ClassCloudFolderNode[],
  id: string,
): ClassCloudFolderNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

/** Nombre total de descendants (toute profondeur), sans compter `node`. */
function countFolderDescendants(node: ClassCloudFolderNode): number {
  let n = 0;
  for (const c of node.children) {
    n += 1 + countFolderDescendants(c);
  }
  return n;
}

function AddRootFolderButton({
  locale,
  classId,
  onCreated,
}: {
  locale: AppLocale;
  classId: string;
  onCreated: () => void;
}) {
  const t = useTranslations("admin.classManage.cloudFolders");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    startTransition(async () => {
      const res = await createClassCloudFolderAction(locale, {
        classId,
        parentId: null,
        name: n,
      });
      if (!res.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("created"));
      setName("");
      setOpen(false);
      onCreated();
    });
  };

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0 gap-1"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {t("addRoot")}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor="new-root">
          {t("newName")}
        </label>
        <Input
          id="new-root"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          disabled={pending}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setName("");
          }}
        >
          {t("cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function FolderBranch({
  locale,
  classId,
  nodes,
  parentKey,
  pending,
  onRefresh,
}: {
  locale: AppLocale;
  classId: string;
  nodes: ClassCloudFolderNode[];
  parentKey: string | null;
  pending: boolean;
  onRefresh: () => void;
}) {
  const ids = useMemo(() => nodes.map((n) => n.id), [nodes]);

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <ul
        className={cn(
          "space-y-1",
          parentKey !== null &&
            "ml-3 border-l-2 border-primary/15 pl-3 sm:ml-4 sm:pl-4",
        )}
      >
        {nodes.map((node) => (
          <li key={node.id}>
            <SortableFolderRow
              locale={locale}
              classId={classId}
              node={node}
              parentKey={parentKey}
              disabled={pending}
              onRefresh={onRefresh}
            />
            {node.children.length > 0 ? (
              <FolderBranch
                locale={locale}
                classId={classId}
                nodes={node.children}
                parentKey={node.id}
                pending={pending}
                onRefresh={onRefresh}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </SortableContext>
  );
}

function SortableFolderRow({
  locale,
  classId,
  node,
  parentKey,
  disabled,
  onRefresh,
}: {
  locale: AppLocale;
  classId: string;
  node: ClassCloudFolderNode;
  parentKey: string | null;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations("admin.classManage.cloudFolders");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [adding, setAdding] = useState(false);
  const [childName, setChildName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setName(node.name);
  }, [node.name]);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: node.id,
      disabled: disabled || pending || node.isSystem,
      data: { parentKey },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const saveRename = () => {
    const n = name.trim();
    if (!n || n === node.name) {
      setEditing(false);
      setName(node.name);
      return;
    }
    startTransition(async () => {
      const res = await renameClassCloudFolderAction(locale, {
        classId,
        folderId: node.id,
        name: n,
      });
      if (!res.ok) {
        if (res.error === "SYSTEM_FOLDER") {
          toast.error(t("errors.systemFolder"));
        } else {
          toast.error(t("errors.generic"));
        }
        setName(node.name);
        return;
      }
      toast.success(t("renamed"));
      setEditing(false);
      onRefresh();
    });
  };

  const addChild = (e: FormEvent) => {
    e.preventDefault();
    const n = childName.trim();
    if (!n) return;
    startTransition(async () => {
      const res = await createClassCloudFolderAction(locale, {
        classId,
        parentId: node.id,
        name: n,
      });
      if (!res.ok) {
        toast.error(t("errors.generic"));
        return;
      }
      toast.success(t("created"));
      setChildName("");
      setAdding(false);
      onRefresh();
    });
  };

  const deleteFolder = () => {
    startTransition(async () => {
      const res = await deleteClassCloudFolderAction(locale, {
        classId,
        folderId: node.id,
      });
      if (!res.ok) {
        if (res.error === "SYSTEM_FOLDER") {
          toast.error(t("errors.systemFolder"));
        } else {
          toast.error(t("errors.generic"));
        }
        return;
      }
      toast.success(t("deleted"));
      setDeleteOpen(false);
      onRefresh();
    });
  };

  const descendantCount = countFolderDescendants(node);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border p-2.5 shadow-sm transition-[box-shadow,border-color]",
        node.isSystem
          ? "border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] to-card dark:border-amber-400/30 dark:from-amber-400/10"
          : "border-border/70 bg-gradient-to-br from-card to-muted/25 hover:border-border dark:to-muted/15",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="touch-manipulation text-muted-foreground hover:text-foreground disabled:opacity-40"
          disabled={disabled || node.isSystem}
          aria-label={t("dragHandle")}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 shrink-0" />
        </button>
        <Folder className="h-4 w-4 shrink-0 text-amber-700/90 dark:text-amber-400/90" />
        {node.isSystem ? (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {node.name}
          </span>
        ) : editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setEditing(false);
                setName(node.name);
              }
            }}
            className="h-8 flex-1"
            autoFocus
            disabled={pending}
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
            onClick={() => setEditing(true)}
          >
            {node.name}
          </button>
        )}
        {!node.isSystem ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 shrink-0 gap-1 px-2"
              disabled={disabled}
              onClick={() => setAdding((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("addChild")}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 shrink-0 gap-1 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disabled || pending}
              aria-label={t("deleteAria")}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("deleteFolder")}</span>
            </Button>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {descendantCount > 0
                      ? t("deleteConfirmDescWithChildren", {
                          name: node.name,
                          count: descendantCount,
                        })
                      : t("deleteConfirmDesc", { name: node.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={pending}
                    onClick={(e) => {
                      e.preventDefault();
                      deleteFolder();
                    }}
                  >
                    {t("deleteConfirmAction")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </div>
      {adding ? (
        <form
          onSubmit={addChild}
          className="mt-2 flex flex-col gap-2 border-t border-border/50 pt-2 sm:flex-row sm:items-end"
        >
          <Input
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="h-8 flex-1"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setChildName("");
              }}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {t("addChildSubmit")}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
