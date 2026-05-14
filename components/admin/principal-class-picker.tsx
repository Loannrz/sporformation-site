"use client";

import { adminClassOptionLabel } from "@/lib/academic-year-display";
import type { AdminClassOption } from "@/lib/data/school";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Props = {
  id: string;
  label: string;
  help?: string;
  emptyHint: string;
  classOptions: AdminClassOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Sélection unique : un seul bouton actif à la fois. */
  singleSelect?: boolean;
};

export function PrincipalClassPicker({
  id,
  label,
  help,
  emptyHint,
  classOptions,
  value,
  onChange,
  singleSelect = false,
}: Props) {
  const toggle = (cid: string, currentlyChecked: boolean) => {
    if (singleSelect) {
      onChange(currentlyChecked ? [] : [cid]);
      return;
    }
    onChange(currentlyChecked ? value.filter((x) => x !== cid) : [...value, cid]);
  };

  const selectedCount = classOptions.filter((c) => value.includes(c.id)).length;

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {classOptions.length > 0 && !singleSelect ? (
          <span
            className={cn(
              "inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums tracking-wide transition-colors",
              selectedCount > 0
                ? "bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 dark:bg-primary/20 dark:text-primary-foreground"
                : "bg-muted/70 text-muted-foreground ring-1 ring-inset ring-border/60",
            )}
            aria-hidden
          >
            {selectedCount}/{classOptions.length}
          </span>
        ) : null}
      </div>
      {help ? (
        <p className="text-xs leading-relaxed text-muted-foreground" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {classOptions.length === 0 ? (
        <p
          className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          {emptyHint}
        </p>
      ) : (
        <div
          id={id}
          role="group"
          aria-describedby={help ? `${id}-help` : undefined}
          aria-label={label}
          className={cn(
            "flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-gradient-to-b from-muted/40 to-muted/15 p-3 shadow-inner",
            "dark:from-muted/25 dark:to-muted/10",
          )}
        >
          {classOptions.map((c) => {
            const checked = value.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role={singleSelect ? "radio" : "checkbox"}
                aria-checked={checked}
                aria-pressed={singleSelect ? undefined : checked}
                onClick={() => toggle(c.id, checked)}
                className={cn(
                  "group/chip relative inline-flex select-none items-center gap-1.5 overflow-hidden rounded-full border px-3.5 py-1.5 text-xs font-medium leading-none",
                  "transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  "active:scale-[0.97]",
                  checked
                    ? cn(
                        "border-transparent text-primary-foreground shadow-md shadow-primary/25",
                        "bg-gradient-to-b from-primary to-primary/85",
                        "hover:from-primary hover:to-primary/95 hover:shadow-lg hover:shadow-primary/30",
                        "ring-1 ring-inset ring-white/20 dark:ring-white/10",
                      )
                    : cn(
                        "border-border/80 bg-background/90 text-foreground/85 shadow-sm backdrop-blur-sm",
                        "hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.06] hover:text-foreground hover:shadow",
                        "dark:bg-background/40 dark:hover:bg-primary/[0.12]",
                      ),
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full transition-all duration-150",
                    checked
                      ? "scale-100 bg-white/25 opacity-100"
                      : "scale-50 bg-transparent opacity-0",
                  )}
                  aria-hidden
                >
                  <Check
                    className={cn(
                      "h-2.5 w-2.5 stroke-[3] transition-transform duration-150",
                      checked ? "scale-100" : "scale-0",
                    )}
                  />
                </span>
                <span className="whitespace-nowrap">
                  {adminClassOptionLabel(c)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
