"use client";

import { adminClassOptionLabel } from "@/lib/academic-year-display";
import type { AdminClassOption } from "@/lib/data/school";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  help?: string;
  emptyHint: string;
  classOptions: AdminClassOption[];
  value: string[];
  onChange: (ids: string[]) => void;
};

export function PrincipalClassPicker({
  id,
  label,
  help,
  emptyHint,
  classOptions,
  value,
  onChange,
}: Props) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      {help ? (
        <p className="text-xs text-muted-foreground" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {classOptions.length === 0 ? (
        <p
          className="text-sm text-amber-700 dark:text-amber-200"
          role="status"
        >
          {emptyHint}
        </p>
      ) : (
        <ul
          id={id}
          aria-describedby={help ? `${id}-help` : undefined}
          className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-input bg-muted/30 p-3"
        >
          {classOptions.map((c) => {
            const checked = value.includes(c.id);
            return (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={checked}
                    onChange={() => {
                      onChange(
                        checked ? value.filter((x) => x !== c.id) : [...value, c.id],
                      );
                    }}
                  />
                  <span>{adminClassOptionLabel(c)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
