"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { reorderRolesAction } from "@/app/actions/org";
import type { CustomSchoolRole } from "@/types";
import type { AppLocale } from "@/i18n/routing";
import { useTranslations } from "next-intl";

type Props = {
  locale: AppLocale;
  initialRoles: CustomSchoolRole[];
  labelFor: (role: CustomSchoolRole) => string;
};

export function OrgChartPlanner({
  locale,
  initialRoles,
  labelFor,
}: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const ids = useMemo(() => roles.map((r) => r.id), [roles]);

  useEffect(() => {
    setRoles(initialRoles);
  }, [initialRoles]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setRoles((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      const snapshot = prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      startTransition(async () => {
        const res = await reorderRolesAction(locale, next.map((r) => r.id));
        if (res && "ok" in res && res.ok === false) {
          setRoles(snapshot);
        }
      });
      return next;
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {roles.map((role) => (
            <SortableRoleItem
              key={role.id}
              role={role}
              label={labelFor(role)}
              disabled={pending}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRoleItem({
  role,
  label,
  disabled,
}: {
  role: CustomSchoolRole;
  label: string;
  disabled: boolean;
}) {
  const t = useTranslations("admin");
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: role.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: disabled ? 0.6 : 1,
  };

  const permCount = Object.values(role.permissions).filter(Boolean).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 rounded-xl border border-border bg-card/80 px-4 py-3 backdrop-blur"
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-primary"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">
          {t("rolesReorderBlurb", { count: permCount })}
        </p>
      </div>
      <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary dark:bg-primary/25">
        {role.id.slice(0, 6)}
      </span>
    </div>
  );
}
