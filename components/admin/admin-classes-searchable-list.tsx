"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SchoolClass } from "@/types";
import { formatAcademicYearRange } from "@/lib/academic-year-display";
import { CalendarRange, ChevronRight, GraduationCap, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

type Props = {
  classes: SchoolClass[];
};

export function AdminClassesSearchableList({ classes }: Props) {
  const t = useTranslations("admin");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return classes;
    return classes.filter((c) => {
      const yearLine = formatAcademicYearRange(
        c.academicYearStart,
        c.academicYearEnd,
      );
      const hay = [
        c.name,
        c.description ?? "",
        yearLine ?? "",
        String(c.studentIds.length),
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "");
      return hay.includes(q);
    });
  }, [classes, query]);

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground">
          <GraduationCap className="h-7 w-7" aria-hidden />
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("classManage.emptyList")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="relative max-w-xl lg:max-w-lg">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("classManage.searchPlaceholder")}
          aria-label={t("classManage.searchAria")}
          className={cn(
            "h-11 bg-background pl-10 shadow-sm",
            query ? "pr-11" : "pr-4",
          )}
          autoComplete="off"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
            aria-label={t("classManage.searchClearAria")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground dark:bg-muted/10">
          {t("classManage.searchNoResults")}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((c) => {
            const yearLine = formatAcademicYearRange(
              c.academicYearStart,
              c.academicYearEnd,
            );
            const count = c.studentIds.length;
            return (
              <Link
                key={c.id}
                href={`/administration/classes/${c.id}`}
                className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full overflow-hidden border-border/70 bg-card/80 shadow-sm transition-[border-color,box-shadow,transform] duration-200 group-hover:border-primary/35 group-hover:shadow-md group-hover:-translate-y-0.5 dark:bg-card/90">
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-xl font-semibold leading-tight transition-colors group-hover:text-primary">
                        {c.name}
                      </CardTitle>
                      <ChevronRight
                        className="mt-1 h-5 w-5 shrink-0 text-muted-foreground opacity-60 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100"
                        aria-hidden
                      />
                    </div>
                    <CardDescription className="space-y-2 text-[0.8125rem] leading-relaxed">
                      {yearLine ? (
                        <span className="flex items-center gap-1.5 font-medium text-foreground/85">
                          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {yearLine}
                        </span>
                      ) : null}
                      {c.description ? (
                        <span className="line-clamp-2 block text-muted-foreground">
                          {c.description}
                        </span>
                      ) : null}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="border-t border-border/50 bg-muted/10 pt-4 dark:bg-muted/5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1 font-normal">
                        <Users className="h-3 w-3" aria-hidden />
                        {t("classManage.studentCount", { count })}
                      </Badge>
                      <span className="text-xs font-medium text-primary">
                        {t("classManage.openClass")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
