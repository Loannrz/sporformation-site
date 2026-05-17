"use client";

import { useMemo, useState, useTransition } from "react";
import {
  approveSiteLeadEmployerAction,
  approveSiteLeadStudentAction,
  approveSiteLeadTepAction,
  deleteSiteLeadEmployerAction,
  deleteSiteLeadStudentAction,
  deleteSiteLeadTepAction,
  markSiteLeadEmployerContactedAction,
  markSiteLeadStudentContactedAction,
  markSiteLeadTepContactedAction,
} from "@/app/actions/site-lead-forms-admin";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { StatTile } from "@/components/admin/admin-stat-tile";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  SiteLeadEmployerRow,
  SiteLeadStudentRow,
  SiteLeadTepRow,
  SiteLeadStatut,
} from "@/lib/data/site-lead-forms";
import type { AppLocale } from "@/i18n/routing";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { enUS, fr as frLocale } from "date-fns/locale";
import {
  Activity,
  Briefcase,
  Building2,
  CakeSlice,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Globe2,
  GraduationCap,
  Heart,
  HelpCircle,
  Inbox,
  Mail,
  MapPin,
  MessageSquareQuote,
  PhoneCall,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  UserCheck,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type StatutFilter = SiteLeadStatut | "all";

type Props = {
  locale: AppLocale;
  students: SiteLeadStudentRow[];
  employers: SiteLeadEmployerRow[];
  teps: SiteLeadTepRow[];
};

function statutPillClasses(s: SiteLeadStatut): string {
  if (s === "nouveau") {
    return "border-transparent bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200";
  }
  if (s === "contacte") {
    return "border-transparent bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200";
  }
  return "border-transparent bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200";
}

function initialsOf(prenom: string, nom: string): string {
  const a = prenom.trim()[0] ?? "";
  const b = nom.trim()[0] ?? "";
  return `${a}${b}`.toUpperCase() || "?";
}

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function telHref(raw: string): string {
  return `tel:${raw.replace(/\s|\(|\)|-/g, "")}`;
}

export function SiteLeadFormsPanel({
  locale,
  students,
  employers,
  teps,
}: Props) {
  const t = useTranslations("admin.leadForms");
  const tAdmin = useTranslations("admin");
  const router = useRouter();
  const dateLocale = locale === "fr" ? frLocale : enUS;
  const [pending, startTransition] = useTransition();
  const [detailStudent, setDetailStudent] =
    useState<SiteLeadStudentRow | null>(null);
  const [detailEmployer, setDetailEmployer] =
    useState<SiteLeadEmployerRow | null>(null);
  const [detailTep, setDetailTep] = useState<SiteLeadTepRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "student"; row: SiteLeadStudentRow }
    | { kind: "employer"; row: SiteLeadEmployerRow }
    | { kind: "tep"; row: SiteLeadTepRow }
    | null
  >(null);
  const [activeTab, setActiveTab] = useState<
    "students" | "employers" | "teps"
  >("students");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatutFilter>("all");

  const fmt = (iso: string) => {
    try {
      return format(new Date(iso), "PPp", { locale: dateLocale });
    } catch {
      return iso;
    }
  };
  const fmtShort = (iso: string) => {
    try {
      return format(new Date(iso), "PP", { locale: dateLocale });
    } catch {
      return iso;
    }
  };

  const stats = useMemo(() => {
    const all: { statut: SiteLeadStatut }[] =
      activeTab === "students"
        ? students
        : activeTab === "employers"
          ? employers
          : teps;
    return {
      total: all.length,
      nouveau: all.filter((r) => r.statut === "nouveau").length,
      contacte: all.filter((r) => r.statut === "contacte").length,
      approuve: all.filter((r) => r.statut === "approuve").length,
    };
  }, [activeTab, students, employers, teps]);

  const pendingStudentCount = students.filter(
    (r) => r.statut === "nouveau",
  ).length;
  const pendingEmployerCount = employers.filter(
    (r) => r.statut === "nouveau",
  ).length;
  const pendingTepCount = teps.filter((r) => r.statut === "nouveau").length;

  const handle = (
    promise: Promise<{ ok: true } | { ok: false; error: string }>,
    okToast: string,
  ) => {
    startTransition(() => {
      void (async () => {
        const r = await promise;
        if (r.ok) {
          toast.success(okToast);
          router.refresh();
        } else {
          toast.error(t("toastError"));
        }
      })();
    });
  };

  const filteredStudents = useMemo(() => {
    const q = normalize(query);
    return students.filter((r) => {
      if (filter !== "all" && r.statut !== filter) return false;
      if (!q) return true;
      const hay = normalize(
        [
          r.prenom,
          r.nom,
          `${r.prenom} ${r.nom}`,
          r.email,
          r.telephone,
          r.formationSouhaitee,
          r.villeFormation ?? "",
          r.villeResidence ?? "",
          r.situation,
          r.employeurStructure,
        ].join(" "),
      );
      return hay.includes(q);
    });
  }, [students, query, filter]);

  const filteredEmployers = useMemo(() => {
    const q = normalize(query);
    return employers.filter((r) => {
      if (filter !== "all" && r.statut !== filter) return false;
      if (!q) return true;
      const hay = normalize(
        [
          r.prenom,
          r.nom,
          `${r.prenom} ${r.nom}`,
          r.email,
          r.telephone,
          r.formationRecherchee,
        ].join(" "),
      );
      return hay.includes(q);
    });
  }, [employers, query, filter]);

  const filteredTeps = useMemo(() => {
    const q = normalize(query);
    return teps.filter((r) => {
      if (filter !== "all" && r.statut !== filter) return false;
      if (!q) return true;
      const hay = normalize(
        [
          r.prenom,
          r.nom,
          `${r.prenom} ${r.nom}`,
          r.email,
          r.telephone,
          r.lieuResidence,
          r.formationVisee,
          r.structureAlternance,
          r.pratiqueSport,
          r.pratiqueSportDetail ?? "",
          ...r.disponibilites,
        ].join(" "),
      );
      return hay.includes(q);
    });
  }, [teps, query, filter]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.row.id;
    const kind = deleteTarget.kind;
    setDeleteTarget(null);
    if (kind === "student") setDetailStudent(null);
    else if (kind === "employer") setDetailEmployer(null);
    else setDetailTep(null);
    handle(
      kind === "student"
        ? deleteSiteLeadStudentAction(locale, id)
        : kind === "employer"
          ? deleteSiteLeadEmployerAction(locale, id)
          : deleteSiteLeadTepAction(locale, id),
      t("toastDeleted"),
    );
  };

  const renderStatutPill = (s: SiteLeadStatut) => (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        statutPillClasses(s),
      )}
    >
      {s === "nouveau" ? <Sparkles className="h-3 w-3" aria-hidden /> : null}
      {s === "contacte" ? <PhoneCall className="h-3 w-3" aria-hidden /> : null}
      {s === "approuve" ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : null}
      {t(`statut.${s}`)}
    </span>
  );

  const renderStudentCard = (r: SiteLeadStudentRow) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setDetailStudent(r)}
      className="group block w-full text-left"
    >
      <Card className="relative overflow-hidden border-border/80 bg-card shadow-sm transition-[border-color,box-shadow,transform] group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg">
        <div
          className="h-1 bg-gradient-to-r from-primary/85 to-accent/75"
          aria-hidden
        />
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold text-primary"
              aria-hidden
            >
              {initialsOf(r.prenom, r.nom)}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base font-semibold leading-snug">
                {r.prenom} {r.nom}
              </CardTitle>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{r.email}</span>
              </p>
            </div>
            {renderStatutPill(r.statut)}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-4 text-sm">
          <p className="flex items-start gap-2">
            <GraduationCap
              className="mt-0.5 size-4 shrink-0 text-primary/70"
              aria-hidden
            />
            <span className="font-medium text-foreground">
              {r.formationSouhaitee}
            </span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin
              className="mt-0.5 size-4 shrink-0 text-primary/60"
              aria-hidden
            />
            <span className="truncate">
              {[r.villeFormation, r.villeResidence]
                .filter(Boolean)
                .join(" · ") || t("notProvided")}
            </span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <Briefcase
              className="mt-0.5 size-4 shrink-0 text-primary/60"
              aria-hidden
            />
            <span className="truncate">{r.situation}</span>
          </p>
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 opacity-70" aria-hidden />
              {fmtShort(r.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              {t("openDetail")}
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );

  const renderEmployerCard = (r: SiteLeadEmployerRow) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setDetailEmployer(r)}
      className="group block w-full text-left"
    >
      <Card className="relative overflow-hidden border-border/80 bg-card shadow-sm transition-[border-color,box-shadow,transform] group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg">
        <div
          className="h-1 bg-gradient-to-r from-accent/80 to-primary/80"
          aria-hidden
        />
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-base font-semibold text-foreground"
              aria-hidden
            >
              <Building2 className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base font-semibold leading-snug">
                {r.prenom} {r.nom}
              </CardTitle>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{r.email}</span>
              </p>
            </div>
            {renderStatutPill(r.statut)}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-4 text-sm">
          <p className="flex items-start gap-2">
            <GraduationCap
              className="mt-0.5 size-4 shrink-0 text-primary/70"
              aria-hidden
            />
            <span className="font-medium text-foreground">
              {r.formationRecherchee}
            </span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            {r.rechercheAlternants ? (
              <Users
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
                aria-hidden
              />
            ) : (
              <UserRound
                className="mt-0.5 size-4 shrink-0 text-primary/60"
                aria-hidden
              />
            )}
            <span>
              {r.rechercheAlternants
                ? t("alternantsYes")
                : t("alternantsNo")}
            </span>
          </p>
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 opacity-70" aria-hidden />
              {fmtShort(r.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              {t("openDetail")}
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );

  const renderTepCard = (r: SiteLeadTepRow) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setDetailTep(r)}
      className="group block w-full text-left"
    >
      <Card className="relative overflow-hidden border-border/80 bg-card shadow-sm transition-[border-color,box-shadow,transform] group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg">
        <div
          className="h-1 bg-gradient-to-r from-emerald-500/80 via-primary/70 to-accent/75"
          aria-hidden
        />
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-base font-semibold text-emerald-700 dark:text-emerald-200"
              aria-hidden
            >
              <Dumbbell className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base font-semibold leading-snug">
                {r.prenom} {r.nom}
              </CardTitle>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="size-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{r.email}</span>
              </p>
            </div>
            {renderStatutPill(r.statut)}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-4 text-sm">
          <p className="flex items-start gap-2">
            <Target
              className="mt-0.5 size-4 shrink-0 text-primary/70"
              aria-hidden
            />
            <span className="font-medium text-foreground">
              {r.formationVisee}
            </span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <MapPin
              className="mt-0.5 size-4 shrink-0 text-primary/60"
              aria-hidden
            />
            <span className="truncate">
              {r.lieuResidence || t("notProvided")}
            </span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <CalendarRange
              className="mt-0.5 size-4 shrink-0 text-primary/60"
              aria-hidden
            />
            <span className="truncate">
              {r.disponibilites.length > 0
                ? r.disponibilites.slice(0, 2).join(" · ") +
                  (r.disponibilites.length > 2
                    ? ` +${r.disponibilites.length - 2}`
                    : "")
                : t("tepNoAvailability")}
            </span>
          </p>
          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5 opacity-70" aria-hidden />
              {fmtShort(r.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              {t("openDetail")}
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          </div>
        </CardContent>
      </Card>
    </button>
  );

  const renderEmpty = (defaultMessage: string) => {
    const searching = query.trim().length > 0 || filter !== "all";
    return (
      <Card className="border-dashed bg-background/60">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="size-6" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {searching ? t("searchEmptyTitle") : defaultMessage}
            </p>
            {searching ? (
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {t("searchEmptyDesc")}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStudentList = () => {
    if (filteredStudents.length === 0) {
      return renderEmpty(t("emptyStudents"));
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredStudents.map((r) => renderStudentCard(r))}
      </div>
    );
  };

  const renderEmployerList = () => {
    if (filteredEmployers.length === 0) {
      return renderEmpty(t("emptyEmployers"));
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredEmployers.map((r) => renderEmployerCard(r))}
      </div>
    );
  };

  const renderTepList = () => {
    if (filteredTeps.length === 0) {
      return renderEmpty(t("emptyTep"));
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredTeps.map((r) => renderTepCard(r))}
      </div>
    );
  };

  const filterOptions: { value: StatutFilter; label: string; count: number }[] =
    [
      { value: "all", label: t("filterAll"), count: stats.total },
      { value: "nouveau", label: t("statut.nouveau"), count: stats.nouveau },
      { value: "contacte", label: t("statut.contacte"), count: stats.contacte },
      { value: "approuve", label: t("statut.approuve"), count: stats.approuve },
    ];

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={tAdmin("backToAdmin")} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden
        >
          <ClipboardList className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold leading-tight">
            {t("pageTitle")}
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {t("pageSubtitle")}
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Inbox className="h-5 w-5" />}
          label={t("statTotal")}
          value={stats.total}
          tone="neutral"
        />
        <StatTile
          icon={<Sparkles className="h-5 w-5" />}
          label={t("statNew")}
          value={stats.nouveau}
          tone="warning"
        />
        <StatTile
          icon={<PhoneCall className="h-5 w-5" />}
          label={t("statCalled")}
          value={stats.contacte}
          tone="info"
        />
        <StatTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={t("statApproved")}
          value={stats.approuve}
          tone="success"
        />
      </section>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (v === "students" || v === "employers" || v === "teps")
            setActiveTab(v);
        }}
      >
        <TabsList>
          <TabsTrigger value="students" className="gap-1.5">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            {t("tabStudents")}
            {pendingStudentCount > 0 ? (
              <span
                className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                aria-label={t("tabPendingAria", {
                  count: pendingStudentCount,
                })}
              >
                {pendingStudentCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="employers" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            {t("tabEmployers")}
            {pendingEmployerCount > 0 ? (
              <span
                className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                aria-label={t("tabPendingAria", {
                  count: pendingEmployerCount,
                })}
              >
                {pendingEmployerCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="teps" className="gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" aria-hidden />
            {t("tabTep")}
            {pendingTepCount > 0 ? (
              <span
                className="ml-1 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                aria-label={t("tabPendingAria", {
                  count: pendingTepCount,
                })}
              >
                {pendingTepCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9 pr-9"
            />
            {query ? (
              <button
                type="button"
                aria-label={t("searchClearAria")}
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((opt) => {
              const active = filter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {opt.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <TabsContent value="students" className="mt-4">
          {renderStudentList()}
        </TabsContent>
        <TabsContent value="employers" className="mt-4">
          {renderEmployerList()}
        </TabsContent>
        <TabsContent value="teps" className="mt-4">
          {renderTepList()}
        </TabsContent>
      </Tabs>

      {/* DETAIL DIALOG — STUDENT */}
      <Dialog
        open={detailStudent != null}
        onOpenChange={(o) => {
          if (!o) setDetailStudent(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-0">
          {detailStudent ? (
            <StudentDetail
              row={detailStudent}
              fmt={fmt}
              renderStatutPill={renderStatutPill}
              pending={pending}
              onApprove={() =>
                handle(
                  approveSiteLeadStudentAction(locale, detailStudent.id),
                  t("toastApproved"),
                )
              }
              onCalled={() =>
                handle(
                  markSiteLeadStudentContactedAction(
                    locale,
                    detailStudent.id,
                  ),
                  t("toastContacted"),
                )
              }
              onDelete={() =>
                setDeleteTarget({ kind: "student", row: detailStudent })
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* DETAIL DIALOG — EMPLOYER */}
      <Dialog
        open={detailEmployer != null}
        onOpenChange={(o) => {
          if (!o) setDetailEmployer(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-0">
          {detailEmployer ? (
            <EmployerDetail
              row={detailEmployer}
              fmt={fmt}
              renderStatutPill={renderStatutPill}
              pending={pending}
              onApprove={() =>
                handle(
                  approveSiteLeadEmployerAction(
                    locale,
                    detailEmployer.id,
                  ),
                  t("toastApproved"),
                )
              }
              onCalled={() =>
                handle(
                  markSiteLeadEmployerContactedAction(
                    locale,
                    detailEmployer.id,
                  ),
                  t("toastContacted"),
                )
              }
              onDelete={() =>
                setDeleteTarget({
                  kind: "employer",
                  row: detailEmployer,
                })
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* DETAIL DIALOG — TEP */}
      <Dialog
        open={detailTep != null}
        onOpenChange={(o) => {
          if (!o) setDetailTep(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto p-0">
          {detailTep ? (
            <TepDetail
              row={detailTep}
              fmt={fmt}
              fmtShort={fmtShort}
              renderStatutPill={renderStatutPill}
              pending={pending}
              onApprove={() =>
                handle(
                  approveSiteLeadTepAction(locale, detailTep.id),
                  t("toastApproved"),
                )
              }
              onCalled={() =>
                handle(
                  markSiteLeadTepContactedAction(locale, detailTep.id),
                  t("toastContacted"),
                )
              }
              onDelete={() =>
                setDeleteTarget({ kind: "tep", row: detailTep })
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={confirmDelete}
            >
              {t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function DetailHeader({
  eyebrow,
  prenom,
  nom,
  email,
  submittedAt,
  statutPill,
  variant,
}: {
  eyebrow: string;
  prenom: string;
  nom: string;
  email: string;
  submittedAt: string;
  statutPill: React.ReactNode;
  variant: "student" | "employer" | "tep";
}) {
  const gradientClass =
    variant === "student"
      ? "bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10"
      : variant === "employer"
        ? "bg-gradient-to-br from-accent/15 via-primary/5 to-primary/10"
        : "bg-gradient-to-br from-emerald-500/15 via-primary/5 to-accent/10";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-t-xl border-b px-6 pb-5 pt-6",
        gradientClass,
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-background/80 shadow-sm ring-1 ring-border"
          aria-hidden
        >
          {variant === "student" ? (
            <span className="text-lg font-semibold text-primary">
              {initialsOf(prenom, nom)}
            </span>
          ) : variant === "employer" ? (
            <Building2 className="h-6 w-6 text-primary" />
          ) : (
            <Dumbbell className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
          <DialogTitle className="mt-0.5 truncate text-xl font-semibold leading-tight">
            {prenom} {nom}
          </DialogTitle>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Mail className="size-3.5 opacity-70" aria-hidden />
            <span className="truncate">{email}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {statutPill}
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarClock className="size-3" aria-hidden />
            {submittedAt}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Field({
  icon,
  label,
  value,
  href,
  fullWidth,
  emphasize,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  fullWidth?: boolean;
  emphasize?: boolean;
}) {
  const content = (
    <span
      className={cn(
        "mt-0.5 block break-words text-sm",
        emphasize ? "font-semibold text-foreground" : "text-foreground",
      )}
    >
      {value || "—"}
    </span>
  );
  return (
    <div className={cn(fullWidth ? "sm:col-span-2" : undefined)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      {href ? (
        <a
          href={href}
          className="mt-0.5 block break-words text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {value || "—"}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

function ConsentRow({
  label,
  granted,
  yesLabel,
  noLabel,
}: {
  label: string;
  granted: boolean;
  yesLabel: string;
  noLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2">
      <p className="text-sm font-medium">{label}</p>
      {granted ? (
        <Badge
          variant="outline"
          className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> {yesLabel}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="gap-1 border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"
        >
          <XCircle className="h-3.5 w-3.5" /> {noLabel}
        </Badge>
      )}
    </div>
  );
}

function QuickActions({
  email,
  telephone,
  callLabel,
  emailLabel,
}: {
  email: string;
  telephone: string;
  callLabel: string;
  emailLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild type="button" size="sm" variant="secondary">
        <a href={telHref(telephone)}>
          <PhoneCall className="mr-1.5 h-4 w-4" />
          {callLabel}
        </a>
      </Button>
      <Button asChild type="button" size="sm" variant="outline">
        <a href={`mailto:${email}`}>
          <Send className="mr-1.5 h-4 w-4" />
          {emailLabel}
        </a>
      </Button>
    </div>
  );
}

function DetailFooterActions({
  pending,
  onApprove,
  onCalled,
  onDelete,
  approveLabel,
  calledLabel,
  deleteLabel,
}: {
  pending: boolean;
  onApprove: () => void;
  onCalled: () => void;
  onDelete: () => void;
  approveLabel: string;
  calledLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 flex flex-wrap gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={onApprove}
        className="bg-emerald-600 text-white hover:bg-emerald-600/90"
      >
        <UserCheck className="mr-1.5 h-4 w-4" />
        {approveLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={onCalled}
      >
        <PhoneCall className="mr-1.5 h-4 w-4" />
        {calledLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={onDelete}
        className="ml-auto"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        {deleteLabel}
      </Button>
    </div>
  );
}

/* ---------------- Student detail body ---------------- */

function StudentDetail({
  row,
  fmt,
  renderStatutPill,
  pending,
  onApprove,
  onCalled,
  onDelete,
}: {
  row: SiteLeadStudentRow;
  fmt: (iso: string) => string;
  renderStatutPill: (s: SiteLeadStatut) => React.ReactNode;
  pending: boolean;
  onApprove: () => void;
  onCalled: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("admin.leadForms");
  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>
          {row.prenom} {row.nom}
        </DialogTitle>
      </DialogHeader>
      <DetailHeader
        eyebrow={t("detailHeaderEyebrowStudent")}
        prenom={row.prenom}
        nom={row.nom}
        email={row.email}
        submittedAt={fmt(row.createdAt)}
        statutPill={renderStatutPill(row.statut)}
        variant="student"
      />

      <div className="space-y-5 px-6 py-5">
        <QuickActions
          email={row.email}
          telephone={row.telephone}
          callLabel={t("callAction")}
          emailLabel={t("emailAction")}
        />

        <Section
          icon={<UserRound className="h-3.5 w-3.5" />}
          title={t("sectionContact")}
        >
          <Field
            icon={<Mail className="h-3 w-3" />}
            label={t("fieldEmail")}
            value={row.email}
            href={`mailto:${row.email}`}
          />
          <Field
            icon={<PhoneCall className="h-3 w-3" />}
            label={t("fieldPhone")}
            value={row.telephone}
            href={telHref(row.telephone)}
          />
          <Field
            icon={<MapPin className="h-3 w-3" />}
            label={t("fieldVilleResidence")}
            value={row.villeResidence ?? t("notProvided")}
          />
        </Section>

        <Section
          icon={<GraduationCap className="h-3.5 w-3.5" />}
          title={t("sectionFormation")}
        >
          <Field
            icon={<GraduationCap className="h-3 w-3" />}
            label={t("fieldFormation")}
            value={row.formationSouhaitee}
            emphasize
            fullWidth
          />
          <Field
            icon={<MapPin className="h-3 w-3" />}
            label={t("fieldVilleFormation")}
            value={row.villeFormation ?? t("notProvided")}
          />
          <Field
            icon={<Briefcase className="h-3 w-3" />}
            label={t("fieldSituation")}
            value={row.situation}
          />
          <Field
            icon={<Building2 className="h-3 w-3" />}
            label={t("fieldEmployeurStructure")}
            value={row.employeurStructure}
            fullWidth
          />
        </Section>

        <Section
          icon={<Globe2 className="h-3.5 w-3.5" />}
          title={t("sectionContext")}
        >
          <Field
            icon={<Heart className="h-3 w-3" />}
            label={t("fieldSource")}
            value={row.sourceConnaissance}
            fullWidth
          />
        </Section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquareQuote className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">
              {t("sectionMotivation")}
            </h3>
          </div>
          <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 p-4 text-sm leading-relaxed">
            {row.motivation?.trim() || "—"}
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">
              {t("sectionConsent")}
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ConsentRow
              label={t("consentRecontact")}
              granted={row.consentementRecontact}
              yesLabel={t("consentYes")}
              noLabel={t("consentNo")}
            />
            <ConsentRow
              label={t("consentPolitique")}
              granted={row.consentementPolitique}
              yesLabel={t("consentYes")}
              noLabel={t("consentNo")}
            />
          </div>
        </section>

        <Section
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          title={t("sectionTracking")}
        >
          <Field
            icon={<Globe2 className="h-3 w-3" />}
            label={t("fieldOrigine")}
            value={row.origine}
          />
          <Field
            icon={<CalendarClock className="h-3 w-3" />}
            label={t("fieldSubmitted")}
            value={fmt(row.createdAt)}
          />
          {row.approuveAt ? (
            <Field
              icon={<CheckCircle2 className="h-3 w-3" />}
              label={t("fieldApprovedAt")}
              value={fmt(row.approuveAt)}
            />
          ) : null}
          {row.contacteAt ? (
            <Field
              icon={<PhoneCall className="h-3 w-3" />}
              label={t("fieldContactedAt")}
              value={fmt(row.contacteAt)}
            />
          ) : null}
        </Section>

        <DetailFooterActions
          pending={pending}
          onApprove={onApprove}
          onCalled={onCalled}
          onDelete={onDelete}
          approveLabel={t("approve")}
          calledLabel={t("markCalled")}
          deleteLabel={t("delete")}
        />
      </div>
    </>
  );
}

/* ---------------- TEP detail body ---------------- */

function TepDetail({
  row,
  fmt,
  fmtShort,
  renderStatutPill,
  pending,
  onApprove,
  onCalled,
  onDelete,
}: {
  row: SiteLeadTepRow;
  fmt: (iso: string) => string;
  fmtShort: (iso: string) => string;
  renderStatutPill: (s: SiteLeadStatut) => React.ReactNode;
  pending: boolean;
  onApprove: () => void;
  onCalled: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("admin.leadForms");
  const sportLine = row.pratiqueSportDetail?.trim()
    ? `${row.pratiqueSport} · ${row.pratiqueSportDetail.trim()}`
    : row.pratiqueSport;

  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>
          {row.prenom} {row.nom}
        </DialogTitle>
      </DialogHeader>
      <DetailHeader
        eyebrow={t("detailHeaderEyebrowTep")}
        prenom={row.prenom}
        nom={row.nom}
        email={row.email}
        submittedAt={fmt(row.createdAt)}
        statutPill={renderStatutPill(row.statut)}
        variant="tep"
      />

      <div className="space-y-5 px-6 py-5">
        <QuickActions
          email={row.email}
          telephone={row.telephone}
          callLabel={t("callAction")}
          emailLabel={t("emailAction")}
        />

        <Section
          icon={<UserRound className="h-3.5 w-3.5" />}
          title={t("sectionContact")}
        >
          <Field
            icon={<Mail className="h-3 w-3" />}
            label={t("fieldEmail")}
            value={row.email}
            href={`mailto:${row.email}`}
          />
          <Field
            icon={<PhoneCall className="h-3 w-3" />}
            label={t("fieldPhone")}
            value={row.telephone}
            href={telHref(row.telephone)}
          />
          <Field
            icon={<MapPin className="h-3 w-3" />}
            label={t("tepFieldLieuResidence")}
            value={row.lieuResidence || t("notProvided")}
          />
          <Field
            icon={<CakeSlice className="h-3 w-3" />}
            label={t("tepFieldBirthdate")}
            value={row.dateNaissance ? fmtShort(row.dateNaissance) : t("notProvided")}
          />
        </Section>

        <Section
          icon={<Target className="h-3.5 w-3.5" />}
          title={t("tepSectionTep")}
        >
          <Field
            icon={<GraduationCap className="h-3 w-3" />}
            label={t("tepFieldFormationVisee")}
            value={row.formationVisee}
            emphasize
            fullWidth
          />
          <Field
            icon={<Building2 className="h-3 w-3" />}
            label={t("tepFieldStructureAlternance")}
            value={row.structureAlternance}
            fullWidth
          />
          <Field
            icon={<HelpCircle className="h-3 w-3" />}
            label={t("tepFieldDejaPasseTep")}
            value={row.dejaPasseTep || t("notProvided")}
            fullWidth
          />
          <div className="sm:col-span-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <TriangleAlert className="h-3 w-3" />
              {t("tepFieldEchecs")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {row.echecsTep.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  {t("tepNoFailures")}
                </span>
              ) : (
                row.echecsTep.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  >
                    {label}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </Section>

        <Section
          icon={<Dumbbell className="h-3.5 w-3.5" />}
          title={t("tepSectionSport")}
        >
          <Field
            icon={<Activity className="h-3 w-3" />}
            label={t("tepFieldPratiqueSport")}
            value={sportLine || t("notProvided")}
            fullWidth
          />
        </Section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarRange className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">
              {t("tepSectionAvailability")}
            </h3>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
            {row.disponibilites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("tepNoAvailability")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {row.disponibilites.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">
              {t("sectionConsent")}
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ConsentRow
              label={t("consentRecontact")}
              granted={row.consentementRecontact}
              yesLabel={t("consentYes")}
              noLabel={t("consentNo")}
            />
            <ConsentRow
              label={t("consentPolitique")}
              granted={row.consentementPolitique}
              yesLabel={t("consentYes")}
              noLabel={t("consentNo")}
            />
          </div>
        </section>

        <Section
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          title={t("sectionTracking")}
        >
          <Field
            icon={<Globe2 className="h-3 w-3" />}
            label={t("fieldOrigine")}
            value={row.origine}
          />
          <Field
            icon={<CalendarClock className="h-3 w-3" />}
            label={t("fieldSubmitted")}
            value={fmt(row.createdAt)}
          />
          {row.approuveAt ? (
            <Field
              icon={<CheckCircle2 className="h-3 w-3" />}
              label={t("fieldApprovedAt")}
              value={fmt(row.approuveAt)}
            />
          ) : null}
          {row.contacteAt ? (
            <Field
              icon={<PhoneCall className="h-3 w-3" />}
              label={t("fieldContactedAt")}
              value={fmt(row.contacteAt)}
            />
          ) : null}
        </Section>

        <DetailFooterActions
          pending={pending}
          onApprove={onApprove}
          onCalled={onCalled}
          onDelete={onDelete}
          approveLabel={t("approve")}
          calledLabel={t("markCalled")}
          deleteLabel={t("delete")}
        />
      </div>
    </>
  );
}

/* ---------------- Employer detail body ---------------- */

function EmployerDetail({
  row,
  fmt,
  renderStatutPill,
  pending,
  onApprove,
  onCalled,
  onDelete,
}: {
  row: SiteLeadEmployerRow;
  fmt: (iso: string) => string;
  renderStatutPill: (s: SiteLeadStatut) => React.ReactNode;
  pending: boolean;
  onApprove: () => void;
  onCalled: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("admin.leadForms");
  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>
          {row.prenom} {row.nom}
        </DialogTitle>
      </DialogHeader>
      <DetailHeader
        eyebrow={t("detailHeaderEyebrowEmployer")}
        prenom={row.prenom}
        nom={row.nom}
        email={row.email}
        submittedAt={fmt(row.createdAt)}
        statutPill={renderStatutPill(row.statut)}
        variant="employer"
      />

      <div className="space-y-5 px-6 py-5">
        <QuickActions
          email={row.email}
          telephone={row.telephone}
          callLabel={t("callAction")}
          emailLabel={t("emailAction")}
        />

        <Section
          icon={<UserRound className="h-3.5 w-3.5" />}
          title={t("sectionContact")}
        >
          <Field
            icon={<Mail className="h-3 w-3" />}
            label={t("fieldEmail")}
            value={row.email}
            href={`mailto:${row.email}`}
          />
          <Field
            icon={<PhoneCall className="h-3 w-3" />}
            label={t("fieldPhone")}
            value={row.telephone}
            href={telHref(row.telephone)}
          />
        </Section>

        <Section
          icon={<Briefcase className="h-3.5 w-3.5" />}
          title={t("sectionEmployerNeeds")}
        >
          <Field
            icon={<GraduationCap className="h-3 w-3" />}
            label={t("fieldFormationRecherchee")}
            value={row.formationRecherchee}
            emphasize
            fullWidth
          />
          <Field
            icon={<Users className="h-3 w-3" />}
            label={t("fieldAlternants")}
            value={
              row.rechercheAlternants ? t("alternantsYes") : t("alternantsNo")
            }
            fullWidth
          />
        </Section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight">
              {t("sectionConsent")}
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ConsentRow
              label={t("consentRecontact")}
              granted={row.consentementRecontact}
              yesLabel={t("consentYes")}
              noLabel={t("consentNo")}
            />
            <ConsentRow
              label={t("consentPolitique")}
              granted={row.consentementPolitique}
              yesLabel={t("consentYes")}
              noLabel={t("consentNo")}
            />
          </div>
        </section>

        <Section
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          title={t("sectionTracking")}
        >
          <Field
            icon={<Globe2 className="h-3 w-3" />}
            label={t("fieldOrigine")}
            value={row.origine}
          />
          <Field
            icon={<CalendarClock className="h-3 w-3" />}
            label={t("fieldSubmitted")}
            value={fmt(row.createdAt)}
          />
          {row.approuveAt ? (
            <Field
              icon={<CheckCircle2 className="h-3 w-3" />}
              label={t("fieldApprovedAt")}
              value={fmt(row.approuveAt)}
            />
          ) : null}
          {row.contacteAt ? (
            <Field
              icon={<PhoneCall className="h-3 w-3" />}
              label={t("fieldContactedAt")}
              value={fmt(row.contacteAt)}
            />
          ) : null}
        </Section>

        <DetailFooterActions
          pending={pending}
          onApprove={onApprove}
          onCalled={onCalled}
          onDelete={onDelete}
          approveLabel={t("approve")}
          calledLabel={t("markCalled")}
          deleteLabel={t("delete")}
        />
      </div>
    </>
  );
}
