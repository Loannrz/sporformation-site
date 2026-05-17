"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "info" | "success" | "warning";

export function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: StatTone;
}) {
  const toneClasses: Record<StatTone, string> = {
    neutral:
      "from-card to-muted/40 text-foreground [&_.icon-wrap]:bg-muted [&_.icon-wrap]:text-foreground",
    info: "from-sky-500/10 to-sky-500/5 text-foreground [&_.icon-wrap]:bg-sky-500/15 [&_.icon-wrap]:text-sky-700 dark:[&_.icon-wrap]:text-sky-200",
    success:
      "from-emerald-500/10 to-emerald-500/5 text-foreground [&_.icon-wrap]:bg-emerald-500/15 [&_.icon-wrap]:text-emerald-700 dark:[&_.icon-wrap]:text-emerald-200",
    warning:
      "from-amber-500/15 to-amber-500/5 text-foreground [&_.icon-wrap]:bg-amber-500/20 [&_.icon-wrap]:text-amber-700 dark:[&_.icon-wrap]:text-amber-200",
  };
  return (
    <Card
      className={cn(
        "border-none bg-gradient-to-br shadow-soft dark:shadow-soft-dark",
        toneClasses[tone],
      )}
    >
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <span className="icon-wrap flex size-9 items-center justify-center rounded-xl">{icon}</span>
        <CardDescription className="text-xs font-medium uppercase tracking-wide">{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
