"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("settings");
  const { theme, setTheme } = useTheme();

  const presets = [
    {
      labelKey: "themeLight" as const,
      value: "light",
      icon: SunMedium,
      blur: "from-primary/25",
    },
    {
      labelKey: "themeDark" as const,
      value: "dark",
      icon: Moon,
      blur: "from-accent/30",
    },
    {
      labelKey: "themeSystem" as const,
      value: "system",
      icon: Laptop,
      blur: "from-muted-foreground/20",
    },
  ] as const;

  const current = theme ?? "system";

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
        <CardTitle className="text-lg">{t("themeTitle")}</CardTitle>
        <CardDescription>{t("themeDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
        {presets.map((p) => {
          const Icon = p.icon;
          const active = current === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setTheme(p.value)}
              className={cn(
                "relative overflow-hidden rounded-2xl border px-4 py-5 text-left transition-all",
                "hover:border-primary/45 hover:shadow-md",
                active
                  ? "border-primary/55 bg-primary/5 shadow-sm ring-2 ring-primary/20"
                  : "border-border/80 bg-muted/25",
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent opacity-60 blur-3xl",
                  p.blur,
                )}
              />
              <Icon className="relative z-10 h-5 w-5 text-primary" />
              <p className="relative z-10 mt-3 text-sm font-semibold leading-tight">
                {t(p.labelKey)}
              </p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
