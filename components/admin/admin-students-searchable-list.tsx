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
import type { StudentAdminListItem } from "@/lib/data/students-admin";
import {
  ChevronRight,
  Mail,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function cardInitials(firstName: string, lastName: string) {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  const pair = `${a}${b}`.toUpperCase();
  return pair || "?";
}

type Props = {
  students: StudentAdminListItem[];
};

export function AdminStudentsSearchableList({ students }: Props) {
  /** Namespace racine `admin` + chemins pointés : évite les clés brutes affichées dans les inputs (next-intl client). */
  const t = useTranslations("admin");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return students;
    return students.filter((s) => {
      const hay = [
        s.firstName,
        s.lastName,
        `${s.firstName} ${s.lastName}`,
        s.email ?? "",
        s.className ?? "",
        s.age != null ? String(s.age) : "",
      ]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "");
      return hay.includes(q);
    });
  }, [students, query]);

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground">
          <UserRound className="h-7 w-7" aria-hidden />
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("students.emptyList")}
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
          placeholder={t("students.searchPlaceholder")}
          aria-label={t("students.searchAria")}
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
            aria-label={t("students.searchClearAria")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground dark:bg-muted/10">
          {t("students.searchNoResults")}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/admin/students/${s.id}`}
              className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="h-full overflow-hidden border-border/70 bg-card/80 shadow-sm transition-[border-color,box-shadow,transform] duration-200 group-hover:border-primary/35 group-hover:shadow-md group-hover:-translate-y-0.5 dark:bg-card/90">
                <CardHeader className="flex flex-row items-start gap-4 pb-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-sm font-semibold uppercase text-primary ring-1 ring-primary/15 dark:bg-primary/20"
                    aria-hidden
                  >
                    {cardInitials(s.firstName, s.lastName)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl font-semibold leading-tight transition-colors group-hover:text-primary">
                        {s.firstName} {s.lastName}
                      </CardTitle>
                      <ChevronRight
                        className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground opacity-60 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100"
                        aria-hidden
                      />
                    </div>
                    <CardDescription className="space-y-2 text-[0.8125rem] leading-relaxed">
                      {s.className ? (
                        <Badge variant="secondary" className="font-normal">
                          {s.className}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {t("students.classNone")}
                        </span>
                      )}
                      {s.age != null ? (
                        <span className="block text-muted-foreground">
                          {t("students.ageLabel")} · {s.age}
                        </span>
                      ) : null}
                      {s.email ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span className="truncate">{s.email}</span>
                        </span>
                      ) : null}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="border-t border-border/50 bg-muted/10 pt-4 dark:bg-muted/5">
                  <span className="text-xs font-medium text-primary">
                    {t("students.openStudent")}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
