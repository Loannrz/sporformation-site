"use client";

import { GraduationCap, Search, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  CloudExplorerClassFolder,
  CloudExplorerTeacherFolder,
} from "@/lib/data/school";

type Props = {
  classFolders: CloudExplorerClassFolder[];
  teacherFolders: CloudExplorerTeacherFolder[];
};

type ClassTimeFilter = "all" | "current" | "past";

function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

/** Explorateur Cloud : recherche, filtres cycle classe, cartes. */
export function CloudExplorer({ classFolders, teacherFolders }: Props) {
  const t = useTranslations("cloud");
  const [tab, setTab] = useState("class");
  const [query, setQuery] = useState("");
  const [classTimeFilter, setClassTimeFilter] = useState<ClassTimeFilter>("all");

  const filteredClasses = useMemo(() => {
    return classFolders.filter((c) => {
      if (!matchesQuery(c.displayLabel, query)) return false;
      if (classTimeFilter === "current") return !c.isPastCycle;
      if (classTimeFilter === "past") return c.isPastCycle;
      return true;
    });
  }, [classFolders, query, classTimeFilter]);

  const filteredTeachers = useMemo(() => {
    return teacherFolders.filter((p) => matchesQuery(p.displayName, query));
  }, [teacherFolders, query]);

  const classEmpty =
    classFolders.length === 0
      ? t("emptyNoClassesInDb")
      : filteredClasses.length === 0
        ? t("explorerNoSearchResults")
        : null;

  const teacherEmpty =
    teacherFolders.length === 0
      ? t("emptyNoTeachersInDb")
      : filteredTeachers.length === 0
        ? t("explorerNoSearchResults")
        : null;

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border/80 bg-gradient-to-b from-muted/35 via-muted/20 to-background/80",
        "p-5 shadow-sm ring-1 ring-black/[0.04] dark:from-muted/25 dark:via-muted/15 dark:to-background/40 dark:ring-white/[0.06]",
        "sm:p-7",
      )}
    >
      <div className="mb-6 space-y-2">
        <label className="sr-only" htmlFor="cloud-explorer-search">
          {t("explorerSearchLabel")}
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="cloud-explorer-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("explorerSearchPlaceholder")}
            autoComplete="off"
            className="h-11 rounded-xl border-border/70 bg-background/90 pl-10 shadow-sm backdrop-blur-sm transition focus-visible:ring-foreground/20"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("explorerSearchHint")}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full space-y-6">
        <TabsList className="grid h-12 w-full grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1.5 dark:bg-muted/50">
          <TabsTrigger
            value="class"
            className="gap-2 rounded-lg text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm sm:text-sm"
          >
            <GraduationCap className="h-4 w-4 shrink-0 opacity-80" />
            {t("tabsClass")}
          </TabsTrigger>
          <TabsTrigger
            value="teacher"
            className="gap-2 rounded-lg text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm sm:text-sm"
          >
            <User className="h-4 w-4 shrink-0 opacity-80" />
            {t("tabsTeacher")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="mt-0 space-y-5 focus-visible:outline-none">
          <div
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
            role="group"
            aria-label={t("explorerClassFilterGroupLabel")}
          >
            <span className="text-xs font-medium text-muted-foreground sm:mr-1">
              {t("explorerClassFilterHeading")}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={classTimeFilter === "all" ? "secondary" : "outline"}
                className={cn(
                  "rounded-full text-xs font-medium",
                  classTimeFilter === "all" &&
                    "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
                )}
                onClick={() => setClassTimeFilter("all")}
              >
                {t("explorerClassFilterAll")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={classTimeFilter === "current" ? "secondary" : "outline"}
                className={cn(
                  "rounded-full text-xs font-medium",
                  classTimeFilter === "current" &&
                    "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
                )}
                onClick={() => setClassTimeFilter("current")}
              >
                {t("explorerClassFilterCurrent")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={classTimeFilter === "past" ? "secondary" : "outline"}
                className={cn(
                  "rounded-full text-xs font-medium",
                  classTimeFilter === "past" &&
                    "border-foreground/15 bg-muted/90 shadow-sm dark:bg-muted",
                )}
                onClick={() => setClassTimeFilter("past")}
              >
                {t("explorerClassFilterPast")}
              </Button>
            </div>
          </div>

          {classEmpty ? (
            <EmptyExplorerHint>{classEmpty}</EmptyExplorerHint>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredClasses.map((c) => (
                <ExplorerCard
                  key={c.id}
                  kind="class"
                  label={c.displayLabel}
                  documentCount={c.documentCount}
                  href={`/cloud/${encodeURIComponent(`classe-${c.id}`)}`}
                  subtitle={t("folderLeadershipBlurb")}
                  meta=""
                  pastCycle={c.isPastCycle}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="teacher" className="mt-0 focus-visible:outline-none">
          {teacherEmpty ? (
            <EmptyExplorerHint>{teacherEmpty}</EmptyExplorerHint>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTeachers.map((p) => (
                <ExplorerCard
                  key={p.id}
                  kind="teacher"
                  label={p.displayName}
                  documentCount={p.documentCount}
                  href={`/cloud/${encodeURIComponent(`prof-${p.id}`)}`}
                  subtitle={t("folderLeadershipBlurb")}
                  meta=""
                  pastCycle={false}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyExplorerHint({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ExplorerCard({
  kind,
  label,
  documentCount,
  subtitle,
  href,
  meta,
  pastCycle,
}: {
  kind: "class" | "teacher";
  label: string;
  documentCount: number;
  subtitle: string;
  href: string;
  meta: string;
  pastCycle: boolean;
}) {
  const t = useTranslations("cloud");
  const Icon = kind === "class" ? GraduationCap : User;
  const iconWrap =
    kind === "class"
      ? "bg-sky-500/10 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200"
      : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400";

  return (
    <div
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-md ring-0 transition",
        "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg dark:bg-card/80 dark:hover:border-foreground/25",
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconWrap,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        {kind === "class" && pastCycle ? (
          <Badge variant="secondary" className="shrink-0 text-[10px] font-medium">
            {t("explorerPastBadge")}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-4 pb-2 pt-0">
        <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground">
          {label}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {t("explorerDocCount", { count: documentCount })}
          </span>
        </div>
        {meta ? (
          <p className="mt-2 text-[11px] text-muted-foreground/90">{meta}</p>
        ) : null}
      </div>
      <div className="mt-auto border-t border-border/50 bg-muted/20 p-3 dark:bg-muted/10">
        <Link
          href={href}
          className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/80 dark:hover:bg-muted/50"
        >
          {t("openFolder")}
        </Link>
      </div>
    </div>
  );
}
