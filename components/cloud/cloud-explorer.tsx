"use client";

import { Files, GraduationCap, Search, User, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  CloudExplorerClassFolder,
  CloudExplorerFileWithUrl,
  CloudExplorerStudentFolder,
  CloudExplorerTeacherFolder,
  CloudStudentUploadOption,
} from "@/lib/data/school";
import type { AppLocale } from "@/i18n/routing";
import type { CloudClassSelectOption } from "./cloud-upload-document-button";
import { CloudExplorerAllDocuments } from "./cloud-explorer-all-documents";

type ExplorerTab = "class" | "teacher" | "student" | "all";

type Props = {
  locale: AppLocale;
  viewerId: string;
  viewerIsDirector: boolean;
  /** Masquer la recherche globale (enseignants dans leur périmètre). */
  hideExplorerSearch?: boolean;
  /** Onglet « par professeur » : réservé à la direction / administration. */
  showTeacherExplorerTab?: boolean;
  /** Onglet initial (liens sidebar « Cloud » vs « Fichiers » avec `?tab=all`). */
  initialExplorerTab?: ExplorerTab;
  classOptions: CloudClassSelectOption[];
  studentOptions: CloudStudentUploadOption[];
  classFolders: CloudExplorerClassFolder[];
  teacherFolders: CloudExplorerTeacherFolder[];
  studentFolders: CloudExplorerStudentFolder[];
  allDocuments: CloudExplorerFileWithUrl[];
};

function matchesQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

/** Explorateur Cloud : recherche et cartes par onglet. */
export function CloudExplorer({
  locale,
  viewerId,
  viewerIsDirector,
  hideExplorerSearch = false,
  showTeacherExplorerTab = true,
  initialExplorerTab,
  classOptions,
  studentOptions,
  classFolders,
  teacherFolders,
  studentFolders,
  allDocuments,
}: Props) {
  const t = useTranslations("cloud");
  const resolvedInitialTab = useMemo(() => {
    let next = initialExplorerTab ?? "class";
    if (next === "teacher" && !showTeacherExplorerTab) next = "class";
    return next;
  }, [initialExplorerTab, showTeacherExplorerTab]);

  const [tab, setTab] = useState<ExplorerTab>(resolvedInitialTab);

  useEffect(() => {
    setTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  const [query, setQuery] = useState("");

  const filteredClasses = useMemo(() => {
    return classFolders.filter((c) => matchesQuery(c.displayLabel, query));
  }, [classFolders, query]);

  const filteredTeachers = useMemo(() => {
    return teacherFolders.filter((p) => matchesQuery(p.displayName, query));
  }, [teacherFolders, query]);

  const filteredStudents = useMemo(() => {
    return studentFolders.filter(
      (s) =>
        matchesQuery(s.displayName, query) ||
        (s.classLabel != null && matchesQuery(s.classLabel, query)),
    );
  }, [studentFolders, query]);

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

  const studentEmpty =
    studentFolders.length === 0
      ? t("emptyNoStudentsInDb")
      : filteredStudents.length === 0
        ? t("explorerNoSearchResults")
        : null;

  useEffect(() => {
    if (!showTeacherExplorerTab && tab === "teacher") {
      setTab("class");
    }
  }, [showTeacherExplorerTab, tab]);

  return (
    <div
      className={cn(
        "w-full rounded-3xl border border-border/70 bg-gradient-to-b shadow-lg shadow-black/[0.03] ring-1 ring-black/[0.03]",
        "from-muted/45 via-muted/20 to-background/90 backdrop-blur-[2px]",
        "dark:from-muted/30 dark:via-muted/15 dark:to-background/60 dark:shadow-black/30 dark:ring-white/[0.07]",
        "p-5 sm:p-8",
      )}
    >
      {!hideExplorerSearch ? (
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
              placeholder={
                tab === "all"
                  ? t("explorerSearchPlaceholderDocs")
                  : t("explorerSearchPlaceholder")
              }
              autoComplete="off"
              className="h-11 rounded-xl border-border/60 bg-background/95 pl-10 shadow-sm backdrop-blur-sm transition focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("explorerSearchHint")}</p>
        </div>
      ) : null}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as ExplorerTab)}
        className="w-full space-y-6"
      >
        <TabsList
          className={cn(
            "grid h-auto min-h-11 w-full gap-1 rounded-xl border border-border/50 bg-muted/50 p-1.5 backdrop-blur-sm dark:bg-muted/40 sm:min-h-12",
            showTeacherExplorerTab
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-2 sm:grid-cols-3",
          )}
        >
          <TabsTrigger
            value="class"
            className="gap-1.5 rounded-lg px-2 text-[11px] data-[state=active]:border data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:shadow-md sm:gap-2 sm:text-sm"
          >
            <GraduationCap className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" />
            <span className="truncate">{t("tabsClass")}</span>
          </TabsTrigger>
          {showTeacherExplorerTab ? (
            <TabsTrigger
              value="teacher"
              className="gap-1.5 rounded-lg px-2 text-[11px] data-[state=active]:border data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:shadow-md sm:gap-2 sm:text-sm"
            >
              <User className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" />
              <span className="truncate">{t("tabsTeacher")}</span>
            </TabsTrigger>
          ) : null}
          <TabsTrigger
            value="student"
            className="gap-1.5 rounded-lg px-2 text-[11px] data-[state=active]:border data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:shadow-md sm:gap-2 sm:text-sm"
          >
            <Users className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" />
            <span className="truncate">{t("tabsStudent")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="gap-1.5 rounded-lg px-2 text-[11px] data-[state=active]:border data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:shadow-md sm:gap-2 sm:text-sm"
          >
            <Files className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" />
            <span className="truncate">{t("tabsAllDocuments")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="class" className="mt-0 space-y-5 focus-visible:outline-none">
          {classEmpty ? (
            <EmptyExplorerHint>{classEmpty}</EmptyExplorerHint>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredClasses.map((c) => (
                <ExplorerCard
                  key={c.id}
                  kind="class"
                  label={c.displayLabel}
                  secondaryLine={null}
                  documentCount={c.documentCount}
                  href={`/cloud/${encodeURIComponent(`classe-${c.id}`)}`}
                  subtitle={t("folderLeadershipBlurb")}
                  meta=""
                  emphasizePrincipal={Boolean(c.isPrincipalClass)}
                  pastCycle={c.isPastCycle}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {showTeacherExplorerTab ? (
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
                    secondaryLine={null}
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
        ) : null}

        <TabsContent value="student" className="mt-0 focus-visible:outline-none">
          {studentEmpty ? (
            <EmptyExplorerHint>{studentEmpty}</EmptyExplorerHint>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredStudents.map((s) => (
                <ExplorerCard
                  key={s.id}
                  kind="student"
                  label={s.displayName}
                  secondaryLine={s.classLabel}
                  documentCount={s.documentCount}
                  href={`/cloud/${encodeURIComponent(`eleve-${s.id}`)}`}
                  subtitle={t("folderStudentBlurb")}
                  meta=""
                  pastCycle={false}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-0 focus-visible:outline-none">
          <CloudExplorerAllDocuments
            files={allDocuments}
            searchQuery={query}
            locale={locale}
            viewerId={viewerId}
            viewerIsDirector={viewerIsDirector}
            classOptions={classOptions}
            studentOptions={studentOptions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyExplorerHint({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/25 px-6 py-14 text-center text-sm text-muted-foreground dark:bg-muted/15">
      {children}
    </div>
  );
}

function ExplorerCard({
  kind,
  label,
  secondaryLine,
  documentCount,
  subtitle,
  href,
  meta,
  pastCycle,
  emphasizePrincipal = false,
}: {
  kind: "class" | "teacher" | "student";
  label: string;
  secondaryLine: string | null;
  documentCount: number;
  subtitle: string;
  href: string;
  meta: string;
  pastCycle: boolean;
  emphasizePrincipal?: boolean;
}) {
  const t = useTranslations("cloud");
  const Icon = kind === "class" ? GraduationCap : kind === "teacher" ? User : Users;
  const iconWrap =
    kind === "class"
      ? "bg-sky-500/10 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200"
      : kind === "teacher"
        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
        : "bg-violet-500/12 text-violet-800 dark:bg-violet-400/90 dark:text-violet-100";

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-md ring-1 ring-black/[0.03] transition dark:bg-card/85 dark:ring-white/[0.05]",
        "hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-black/40",
        emphasizePrincipal && kind === "class"
          ? "border-red-600/55 ring-2 ring-red-600/75 hover:border-red-700/55 dark:border-red-500/45 dark:ring-red-500/65 dark:hover:border-red-400/50"
          : "border-border/65 hover:border-primary/25 hover:ring-primary/10 dark:hover:border-primary/35",
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
        {secondaryLine ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {secondaryLine}
          </p>
        ) : null}
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
      <div className="mt-auto border-t border-border/50 bg-gradient-to-b from-muted/25 to-muted/40 p-3.5 dark:from-muted/15 dark:to-muted/30">
        <Link
          href={href}
          className="inline-flex w-full items-center justify-center rounded-xl border border-transparent bg-background/90 px-4 py-2.5 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/20 hover:bg-primary/[0.06] hover:text-primary dark:bg-background/70"
        >
          {t("openFolder")}
        </Link>
      </div>
    </div>
  );
}
