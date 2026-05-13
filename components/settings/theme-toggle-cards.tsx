"use client";

import { useTheme } from "next-themes";
import { Laptop, Moon, SunMedium } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Cartes pour basculer le thème clair · sombre · système. */
export default function ThemeToggleCards() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const presets = [
    {
      label: "Clair",
      value: "light",
      icon: SunMedium,
      blur: "from-primary/25",
    },
    {
      label: "Sombre",
      value: "dark",
      icon: Moon,
      blur: "from-accent/30",
    },
    {
      label: "Automatique",
      value: "system",
      icon: Laptop,
      blur: "from-muted-foreground/20",
    },
  ] as const;

  const current = theme ?? "system";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Aspect</CardTitle>
        <CardDescription>
          next-themes synchronise la classe `.dark`. Thème système résolu :{" "}
          <span className="font-semibold">{resolvedTheme ?? "—"}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {presets.map((p) => {
          const Icon = p.icon;
          const active = current === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setTheme(p.value)}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border px-4 py-6 text-left transition hover:border-primary/50",
                active ? "border-primary/60 bg-muted/75" : "bg-muted/30",
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent opacity-65 blur-3xl",
                  p.blur,
                )}
              />
              <Icon className="relative z-10 h-6 w-6 text-primary" />
              <p className="relative z-10 mt-4 font-semibold">{p.label}</p>
              <p className="relative z-10 text-xs text-muted-foreground">
                {p.value.toUpperCase()}
              </p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
