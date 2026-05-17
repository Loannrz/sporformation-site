"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { SessionUser } from "@/types";
import type {
  TeacherDocumentTemplateRow,
  TeacherOnboardingRow,
} from "@/lib/data/teacher-documents";
import {
  resolveTeacherDocumentsTrackingState,
  type TeacherDocumentsTrackingState,
} from "@/lib/data/teacher-documents-tracking";
import { isDirector } from "@/lib/roles";
import {
  approveTeacherDocumentsAccessAction,
  deleteTeacherDocumentTemplateAction,
  resetTeacherDocumentsBundleAction,
  revokeTeacherDocumentsApprovalAction,
  seedDefaultTeacherDocumentTemplatesAction,
  upsertTeacherDocumentTemplateAction,
} from "@/app/actions/teacher-documents";
import {
  closeVoluntaryDocumentRequestAction,
  createVoluntaryDocumentRequestAction,
} from "@/app/actions/teacher-voluntary-documents";
import type { StaffAdminRow } from "@/lib/data/staff-admin";
import type { VoluntaryCampaignAdminRow } from "@/lib/data/teacher-voluntary-documents";
import { VoluntaryCampaignDocumentsDialog } from "@/components/admin/voluntary-campaign-documents-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  FolderOpen,
  Inbox,
  Mail,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Users,
  Eye,
  type LucideIcon,
} from "lucide-react";

type PendingUi = TeacherOnboardingRow & {
  totalRequests: number;
  filledRequests: number;
};

const STATE_TONE: Record<
  TeacherDocumentsTrackingState,
  {
    badgeClass: string;
    barClass: string;
    haloClass: string;
    ringClass: string;
    dotClass: string;
  }
> = {
  missing: {
    badgeClass:
      "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    barClass: "bg-rose-500",
    haloClass:
      "from-rose-500/[0.12] via-rose-500/[0.04] to-transparent dark:from-rose-500/20",
    ringClass: "ring-rose-500/25",
    dotClass: "bg-rose-500",
  },
  partial: {
    badgeClass:
      "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    barClass: "bg-sky-500",
    haloClass:
      "from-sky-500/[0.12] via-sky-500/[0.04] to-transparent dark:from-sky-500/20",
    ringClass: "ring-sky-500/25",
    dotClass: "bg-sky-500",
  },
  submitted: {
    badgeClass:
      "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    barClass: "bg-sky-500",
    haloClass:
      "from-sky-500/[0.14] via-sky-500/[0.05] to-transparent dark:from-sky-500/22",
    ringClass: "ring-sky-500/30",
    dotClass: "bg-sky-500",
  },
  ready: {
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    barClass: "bg-emerald-500",
    haloClass:
      "from-emerald-500/[0.12] via-emerald-500/[0.04] to-transparent dark:from-emerald-500/20",
    ringClass: "ring-emerald-500/25",
    dotClass: "bg-emerald-500",
  },
  empty: {
    badgeClass:
      "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    barClass: "bg-rose-500",
    haloClass:
      "from-rose-500/[0.10] via-rose-500/[0.04] to-transparent dark:from-rose-500/18",
    ringClass: "ring-rose-500/25",
    dotClass: "bg-rose-500",
  },
};

function initialsOf(first: string, last: string): string {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

type Props = {
  locale: AppLocale;
  viewer: SessionUser;
  templates: TeacherDocumentTemplateRow[];
  pending: PendingUi[];
  validated: TeacherOnboardingRow[];
  voluntaryCampaigns: VoluntaryCampaignAdminRow[];
  staffForVoluntaryPicker: StaffAdminRow[];
};

export function TeacherDocumentsAdminPanel({
  locale,
  viewer,
  templates: initialTemplates,
  pending,
  validated,
  voluntaryCampaigns,
  staffForVoluntaryPicker,
}: Props) {
  const t = useTranslations("admin.teacherDocuments");
  const router = useRouter();
  const [pendingTr, startTransition] = useTransition();

  const [trackingQuery, setTrackingQuery] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [appliesNew, setAppliesNew] = useState(true);

  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const [volLabel, setVolLabel] = useState("");
  const [volDescription, setVolDescription] = useState("");
  const [volScopeAll, setVolScopeAll] = useState(true);
  const [volSelectedIds, setVolSelectedIds] = useState<Set<string>>(() => new Set());
  const [volPickerQuery, setVolPickerQuery] = useState("");
  const [volCampaignView, setVolCampaignView] = useState<{ id: string; label: string } | null>(null);

  const director = isDirector(viewer);

  const filteredPending = useMemo(() => {
    const q = normalizeQuery(trackingQuery);
    if (!q) return pending;
    return pending.filter((p) => {
      const blob =
        `${p.first_name ?? ""} ${p.last_name ?? ""} ${p.email ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [pending, trackingQuery]);

  const filteredValidated = useMemo(() => {
    const q = normalizeQuery(trackingQuery);
    if (!q) return validated;
    return validated.filter((p) => {
      const blob =
        `${p.first_name ?? ""} ${p.last_name ?? ""} ${p.email ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [validated, trackingQuery]);

  const filteredTemplates = useMemo(() => {
    const q = normalizeQuery(catalogQuery);
    if (!q) return initialTemplates;
    return initialTemplates.filter((tpl) => {
      const blob =
        `${tpl.label ?? ""} ${tpl.description ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [initialTemplates, catalogQuery]);

  const filteredStaffVoluntary = useMemo(() => {
    const q = normalizeQuery(volPickerQuery);
    if (!q) return staffForVoluntaryPicker;
    return staffForVoluntaryPicker.filter((s) => {
      const blob = `${s.firstName} ${s.lastName} ${s.email}`.toLowerCase();
      return blob.includes(q);
    });
  }, [staffForVoluntaryPicker, volPickerQuery]);

  const resetForm = () => {
    setEditId(null);
    setLabel("");
    setDescription("");
    setSortOrder(initialTemplates.length);
    setActive(true);
    setAppliesNew(true);
  };

  const startEdit = (tpl: TeacherDocumentTemplateRow) => {
    setEditId(tpl.id);
    setLabel(tpl.label);
    setDescription(tpl.description ?? "");
    setSortOrder(tpl.sort_order);
    setActive(tpl.active);
    setAppliesNew(tpl.applies_to_new_teachers);
  };

  const saveTemplate = () => {
    if (!label.trim()) {
      toast.error(t("toastError"));
      return;
    }
    startTransition(async () => {
      const res = await upsertTeacherDocumentTemplateAction(locale, {
        id: editId,
        label,
        description: description || null,
        sortOrder,
        active,
        appliesToNewTeachers: appliesNew,
      });
      if (res.ok) {
        toast.success(t("toastSaved"));
        resetForm();
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const deleteTpl = (id: string) => {
    startTransition(async () => {
      const res = await deleteTeacherDocumentTemplateAction(locale, id);
      if (res.ok) {
        toast.success(t("toastDeleted"));
        if (editId === id) resetForm();
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const seed = () => {
    startTransition(async () => {
      const res = await seedDefaultTeacherDocumentTemplatesAction(locale);
      if (res.ok) {
        toast.success(res.inserted ? t("seedDone") : t("toastSaved"));
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const toggleVolTeacher = (id: string) => {
    setVolSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitVoluntaryRequest = () => {
    if (!volLabel.trim()) {
      toast.error(t("toastError"));
      return;
    }
    if (!volScopeAll && volSelectedIds.size === 0) {
      toast.error(t("voluntaryNoTeachersSelected"));
      return;
    }
    startTransition(async () => {
      const res = await createVoluntaryDocumentRequestAction(locale, {
        label: volLabel.trim(),
        description: volDescription.trim() || null,
        scopeKind: volScopeAll ? "all_staff_teachers" : "selected",
        teacherIds: volScopeAll ? undefined : [...volSelectedIds],
      });
      if (res.ok) {
        toast.success(t("toastSaved"));
        setVolLabel("");
        setVolDescription("");
        setVolScopeAll(true);
        setVolSelectedIds(new Set());
        setVolPickerQuery("");
        router.refresh();
      } else if (res.error === "NO_RECIPIENTS") {
        toast.error(t("voluntaryNoRecipients"));
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const closeVoluntaryCampaign = (requestId: string) => {
    startTransition(async () => {
      const res = await closeVoluntaryDocumentRequestAction(locale, requestId);
      if (res.ok) {
        toast.success(t("toastSaved"));
        if (volCampaignView?.id === requestId) {
          setVolCampaignView(null);
        }
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const approve = (id: string) => {
    startTransition(async () => {
      const res = await approveTeacherDocumentsAccessAction(locale, id);
      if (res.ok) {
        toast.success(t("toastSaved"));
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const resetBundle = (id: string) => {
    startTransition(async () => {
      const res = await resetTeacherDocumentsBundleAction(locale, id);
      if (res.ok) {
        toast.success(t("toastSaved"));
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const res = await revokeTeacherDocumentsApprovalAction(locale, id);
      if (res.ok) {
        toast.success(t("toastSaved"));
        router.refresh();
      } else {
        toast.error(t("toastError"));
      }
    });
  };

  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/[0.10] via-muted/30 to-background p-6 shadow-md ring-1 ring-black/[0.04] dark:from-primary/[0.16] dark:via-muted/15 dark:to-background dark:ring-white/[0.06] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t("headerEyebrow")}
            </p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("pageTitle")}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("pageSubtitle")}
            </p>
          </div>
          <div className="grid w-full max-w-md grid-cols-3 gap-2 sm:gap-3">
            <KpiCard
              icon={Inbox}
              label={t("kpiPendingLabel")}
              value={pending.length}
              tone="warning"
            />
            <KpiCard
              icon={CheckCircle2}
              label={t("kpiApprovedLabel")}
              value={validated.length}
              tone="success"
            />
            <KpiCard
              icon={FolderOpen}
              label={t("kpiTemplatesLabel")}
              value={initialTemplates.length}
              tone="neutral"
            />
          </div>
        </div>
      </header>

      <Tabs defaultValue="tracking" className="w-full space-y-6">
        <TabsList className="grid h-auto min-h-12 w-full grid-cols-1 gap-1 rounded-xl border border-border/50 bg-muted/50 p-1.5 backdrop-blur-sm dark:bg-muted/40 sm:grid-cols-3">
          <TabsTrigger
            value="tracking"
            className="gap-2 rounded-lg data-[state=active]:border data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:shadow-md"
          >
            <ClipboardList className="h-4 w-4 opacity-80" />
            <span>{t("tabTracking")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="catalog"
            className="gap-2 rounded-lg data-[state=active]:border data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:shadow-md"
          >
            <FolderOpen className="h-4 w-4 opacity-80" />
            <span>{t("tabCatalog")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="voluntary"
            className="gap-2 rounded-lg data-[state=active]:border data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:shadow-md"
          >
            <Megaphone className="h-4 w-4 opacity-80" />
            <span>{t("tabVoluntary")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="space-y-8 focus-visible:outline-none">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
              placeholder={t("searchPlaceholderTracking")}
              className="h-11 rounded-xl border-border/60 bg-background/95 pl-10 shadow-sm backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/25"
              aria-label={t("searchPlaceholderTracking")}
            />
          </div>

          <section className="space-y-4">
            <SectionHeader
              icon={Inbox}
              title={t("trackingPending")}
              count={filteredPending.length}
              total={pending.length}
            />
            {pending.length === 0 ? (
              <EmptyHint
                icon={Inbox}
                title={t("noPendingTitle")}
                description={t("noPendingDesc")}
              />
            ) : filteredPending.length === 0 ? (
              <EmptyHint
                icon={Search}
                title={t("noSearchResults")}
                description=""
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPending.map((p) => {
                  const state = resolveTeacherDocumentsTrackingState(p);
                  const tone = STATE_TONE[state];
                  const progress = p.totalRequests
                    ? Math.round((p.filledRequests / p.totalRequests) * 100)
                    : 0;
                  return (
                    <li key={p.id}>
                      <Card
                        className={cn(
                          "group relative h-full overflow-hidden border-border/70 ring-1 transition hover:-translate-y-0.5 hover:shadow-md",
                          tone.ringClass,
                        )}
                      >
                        <div
                          aria-hidden
                          className={cn(
                            "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b",
                            tone.haloClass,
                          )}
                        />
                        <CardContent className="relative space-y-4 p-5">
                          <div className="flex items-start gap-3">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/10">
                              {initialsOf(p.first_name, p.last_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold leading-tight">
                                {p.first_name} {p.last_name}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                                <Mail className="h-3 w-3 shrink-0 opacity-60" />
                                <span className="truncate">{p.email ?? "—"}</span>
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                  tone.badgeClass,
                                )}
                              >
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    tone.dotClass,
                                  )}
                                  aria-hidden
                                />
                                {state === "missing"
                                  ? t("filesMissing")
                                  : state === "partial"
                                    ? t("filesPartial")
                                    : state === "submitted"
                                      ? t("filesSubmitted")
                                      : state === "ready"
                                        ? t("filesReady")
                                        : t("filesNoRequests")}
                              </span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">
                                {p.totalRequests > 0
                                  ? t("filesProgress", {
                                      filled: p.filledRequests,
                                      total: p.totalRequests,
                                    })
                                  : "—"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  tone.barClass,
                                )}
                                style={{
                                  width: `${p.totalRequests > 0 ? progress : 0}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              asChild
                            >
                              <Link
                                href={`/administration/comptes/${p.id}`}
                                className="inline-flex items-center gap-1.5"
                              >
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                {t("openProfile")}
                              </Link>
                            </Button>
                            {director ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                  onClick={() => setConfirmApproveId(p.id)}
                                  disabled={pendingTr}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                  {t("approveAccess")}
                                </Button>
                                {p.teacher_documents_bundle_submitted_at ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => resetBundle(p.id)}
                                    disabled={pendingTr}
                                  >
                                    {t("resetBundle")}
                                  </Button>
                                ) : null}
                              </>
                            ) : (
                              <span className="self-center text-[11px] text-muted-foreground">
                                {t("directorOnly")}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeader
              icon={CheckCircle2}
              title={t("trackingApproved")}
              count={filteredValidated.length}
              total={validated.length}
              tone="success"
            />
            {validated.length === 0 ? (
              <EmptyHint
                icon={CheckCircle2}
                title={t("noApprovedTitle")}
                description={t("noApprovedDesc")}
              />
            ) : filteredValidated.length === 0 ? (
              <EmptyHint
                icon={Search}
                title={t("noSearchResults")}
                description=""
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredValidated.map((p) => (
                  <li key={p.id}>
                    <Card className="group relative h-full overflow-hidden border-border/70 ring-1 ring-emerald-500/20 transition hover:-translate-y-0.5 hover:shadow-md">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-emerald-500/[0.10] via-emerald-500/[0.04] to-transparent dark:from-emerald-500/20"
                      />
                      <CardContent className="relative space-y-3 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                            {initialsOf(p.first_name, p.last_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold leading-tight">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0 opacity-60" />
                              <span className="truncate">{p.email ?? "—"}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            {t("stateApproved")}
                          </span>
                          {p.teacher_documents_approved_at ? (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {t("approvedAt", {
                                date: new Date(
                                  p.teacher_documents_approved_at,
                                ).toLocaleDateString(locale),
                              })}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            asChild
                          >
                            <Link
                              href={`/administration/comptes/${p.id}`}
                              className="inline-flex items-center gap-1.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                              {t("openProfile")}
                            </Link>
                          </Button>
                          {director ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-destructive/40 text-destructive hover:bg-destructive/[0.08]"
                              onClick={() => setConfirmRevokeId(p.id)}
                              disabled={pendingTr}
                            >
                              {t("revokeAccess")}
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-6 focus-visible:outline-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder={t("searchPlaceholderCatalog")}
                className="h-11 rounded-xl border-border/60 bg-background/95 pl-10 shadow-sm backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/25"
                aria-label={t("searchPlaceholderCatalog")}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {initialTemplates.length === 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={seed}
                  disabled={pendingTr}
                  className="gap-1.5"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t("seedButton")}
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={resetForm}
                disabled={pendingTr}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t("addTemplate")}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,420px)]">
            <Card className="border-border/70">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary opacity-80" aria-hidden />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("tabCatalog")}
                  </h2>
                  <Badge variant="outline" className="ml-auto font-normal">
                    {filteredTemplates.length}/{initialTemplates.length}
                  </Badge>
                </div>
                {initialTemplates.length === 0 ? (
                  <EmptyHint
                    icon={FolderOpen}
                    title={t("catalogEmpty")}
                    description=""
                  />
                ) : filteredTemplates.length === 0 ? (
                  <EmptyHint
                    icon={Search}
                    title={t("noSearchResults")}
                    description=""
                  />
                ) : (
                  <ul className="space-y-2">
                    {filteredTemplates.map((tpl) => (
                      <li
                        key={tpl.id}
                        className={cn(
                          "group flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-3 transition hover:border-primary/30 hover:bg-muted/30 sm:flex-row sm:items-center",
                          editId === tpl.id &&
                            "border-primary/50 bg-primary/[0.05] ring-1 ring-primary/30",
                        )}
                      >
                        <div className="flex flex-1 items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="size-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {tpl.label}
                            </p>
                            {tpl.description ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {tpl.description}
                              </p>
                            ) : null}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {tpl.active ? (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                                >
                                  {t("tplBadgeActive")}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-muted-foreground/30 text-[10px] font-normal text-muted-foreground"
                                >
                                  {t("tplBadgeInactive")}
                                </Badge>
                              )}
                              {tpl.applies_to_new_teachers ? (
                                <Badge
                                  variant="outline"
                                  className="border-primary/30 bg-primary/10 text-[10px] font-medium text-primary"
                                >
                                  {t("tplBadgeAutoSeed")}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(tpl)}
                            disabled={pendingTr}
                          >
                            {t("editTemplate")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/[0.08] hover:text-destructive"
                            onClick={() => deleteTpl(tpl.id)}
                            disabled={pendingTr}
                          >
                            {t("deleteTemplate")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="h-fit border-border/70 lg:sticky lg:top-24">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <UserCircle2 className="h-4 w-4 text-primary opacity-80" aria-hidden />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {editId ? t("editTemplate") : t("addTemplate")}
                  </h2>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="td-label">{t("templateLabel")}</Label>
                  <Input
                    id="td-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={pendingTr}
                    placeholder={t("templateLabel")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="td-desc">{t("templateDescription")}</Label>
                  <Input
                    id="td-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={pendingTr}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="td-order">{t("templateOrder")}</Label>
                  <Input
                    id="td-order"
                    type="number"
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(parseInt(e.target.value, 10) || 0)
                    }
                    disabled={pendingTr}
                  />
                </div>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 text-sm transition hover:bg-muted/40">
                  <span>{t("templateActive")}</span>
                  <Switch
                    checked={active}
                    onCheckedChange={setActive}
                    disabled={pendingTr}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 text-sm transition hover:bg-muted/40">
                  <span>{t("templateAppliesNew")}</span>
                  <Switch
                    checked={appliesNew}
                    onCheckedChange={setAppliesNew}
                    disabled={pendingTr}
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    onClick={saveTemplate}
                    disabled={pendingTr}
                  >
                    {t("saveTemplate")}
                  </Button>
                  {editId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={resetForm}
                      disabled={pendingTr}
                    >
                      {t("cancelEdit")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="voluntary" className="space-y-6 focus-visible:outline-none">
          <p className="text-sm text-muted-foreground">{t("voluntaryTabHint")}</p>
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,420px)]">
            <Card className="border-border/70">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("voluntaryNewRequest")}
                </h2>
                <div className="space-y-2">
                  <Label htmlFor="vol-label">{t("voluntaryLabelField")}</Label>
                  <Input
                    id="vol-label"
                    value={volLabel}
                    onChange={(e) => setVolLabel(e.target.value)}
                    disabled={pendingTr}
                    placeholder={t("voluntaryLabelPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vol-desc">{t("voluntaryDescriptionField")}</Label>
                  <Input
                    id="vol-desc"
                    value={volDescription}
                    onChange={(e) => setVolDescription(e.target.value)}
                    disabled={pendingTr}
                    placeholder={t("voluntaryDescriptionPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">{t("voluntaryScopeTitle")}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={volScopeAll ? "default" : "outline"}
                      onClick={() => setVolScopeAll(true)}
                      disabled={pendingTr}
                    >
                      {t("voluntaryScopeAll")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!volScopeAll ? "default" : "outline"}
                      onClick={() => setVolScopeAll(false)}
                      disabled={pendingTr}
                    >
                      {t("voluntaryScopeSelected")}
                    </Button>
                  </div>
                </div>
                {!volScopeAll ? (
                  <div className="space-y-2">
                    <Label>{t("voluntaryPickTeachers")}</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={volPickerQuery}
                        onChange={(e) => setVolPickerQuery(e.target.value)}
                        placeholder={t("voluntarySearchStaff")}
                        disabled={pendingTr}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 p-2 text-sm">
                      {filteredStaffVoluntary.length === 0 ? (
                        <p className="p-2 text-muted-foreground">{t("noSearchResults")}</p>
                      ) : (
                        <ul className="space-y-1">
                          {filteredStaffVoluntary.map((s) => (
                            <li key={s.id}>
                              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-input"
                                  checked={volSelectedIds.has(s.id)}
                                  onChange={() => toggleVolTeacher(s.id)}
                                  disabled={pendingTr}
                                />
                                <span className="min-w-0">
                                  {s.firstName} {s.lastName}
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {s.email}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("voluntarySelectedCount", { count: volSelectedIds.size })}
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  onClick={submitVoluntaryRequest}
                  disabled={pendingTr}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("voluntarySubmit")}
                </Button>
              </CardContent>
            </Card>

            <Card className="h-fit overflow-hidden rounded-2xl border-border/70 bg-gradient-to-b from-card to-muted/20 shadow-md ring-1 ring-black/[0.04] dark:from-card dark:to-muted/10 dark:ring-white/[0.06] lg:sticky lg:top-24">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Megaphone className="h-4 w-4" aria-hidden />
                  </div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("voluntaryCampaignsTitle")}
                  </h2>
                </div>
                {voluntaryCampaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("voluntaryCampaignsEmpty")}</p>
                ) : (
                  <ul className="space-y-4">
                    {voluntaryCampaigns.map((c) => {
                      const pct =
                        c.totalRecipients > 0
                          ? Math.round((c.filledRecipients / c.totalRecipients) * 100)
                          : 0;
                      const isComplete =
                        c.totalRecipients > 0 && c.filledRecipients >= c.totalRecipients;
                      const hasPartial =
                        c.totalRecipients > 0 &&
                        c.filledRecipients > 0 &&
                        c.filledRecipients < c.totalRecipients;

                      const surfaceRing = isComplete
                        ? "ring-emerald-500/25 dark:ring-emerald-400/25"
                        : hasPartial
                          ? "ring-sky-500/25 dark:ring-sky-400/20"
                          : "ring-primary/15 dark:ring-primary/20";

                      const haloClass = isComplete
                        ? "from-emerald-500/[0.14] via-emerald-500/[0.05] to-transparent dark:from-emerald-500/[0.18]"
                        : hasPartial
                          ? "from-sky-500/[0.14] via-sky-500/[0.05] to-transparent dark:from-sky-500/[0.18]"
                          : "from-primary/[0.10] via-primary/[0.04] to-transparent dark:from-primary/[0.14]";

                      const iconShell = isComplete
                        ? "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
                        : hasPartial
                          ? "bg-sky-500/12 text-sky-700 ring-sky-500/25 dark:text-sky-300"
                          : "bg-primary/12 text-primary ring-primary/18";

                      const barClass = isComplete
                        ? "bg-emerald-500 shadow-[0_0_12px_-2px_rgba(16,185,129,0.55)] dark:bg-emerald-400"
                        : hasPartial
                          ? "bg-sky-500 shadow-[0_0_12px_-2px_rgba(14,165,233,0.45)] dark:bg-sky-400"
                          : "bg-primary/75";

                      return (
                        <li key={c.id}>
                          <div
                            className={cn(
                              "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm backdrop-blur-sm transition duration-300",
                              "ring-1 hover:-translate-y-0.5 hover:shadow-md",
                              surfaceRing,
                            )}
                          >
                            <div
                              aria-hidden
                              className={cn(
                                "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b",
                                haloClass,
                              )}
                            />
                            <div className="relative space-y-4 p-4 sm:p-5">
                              <div className="flex gap-3.5">
                                <div
                                  className={cn(
                                    "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
                                    iconShell,
                                  )}
                                >
                                  <FileText className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                                </div>
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <p className="text-[15px] font-semibold leading-snug tracking-tight text-balance">
                                      {c.label}
                                    </p>
                                    <span
                                      className={cn(
                                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider tabular-nums",
                                        isComplete
                                          ? "border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-800 dark:text-emerald-200"
                                          : "border-muted-foreground/25 bg-muted/40 text-muted-foreground",
                                      )}
                                    >
                                      {pct}%
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                                        c.scope_kind === "all_staff_teachers"
                                          ? "border-primary/28 bg-primary/[0.08] text-primary"
                                          : "border-muted-foreground/30 bg-muted/45 text-muted-foreground",
                                      )}
                                    >
                                      {c.scope_kind === "all_staff_teachers" ? (
                                        <Users className="h-3 w-3 opacity-70" aria-hidden />
                                      ) : (
                                        <UserCircle2 className="h-3 w-3 opacity-70" aria-hidden />
                                      )}
                                      {c.scope_kind === "all_staff_teachers"
                                        ? t("voluntaryScopeAllBadge")
                                        : t("voluntaryScopeSelectedBadge")}
                                    </span>
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                      {t("voluntaryProgress", {
                                        filled: c.filledRecipients,
                                        total: c.totalRecipients,
                                      })}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/40">
                                  <div
                                    className={cn("h-full rounded-full transition-[width]", barClass)}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="gap-2 shadow-sm"
                                  onClick={() =>
                                    setVolCampaignView({
                                      id: c.id,
                                      label: c.label,
                                    })
                                  }
                                  disabled={pendingTr}
                                >
                                  <Eye className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                                  {t("voluntaryViewDocuments")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-border/80 bg-background/70 hover:bg-muted/60"
                                  onClick={() => closeVoluntaryCampaign(c.id)}
                                  disabled={pendingTr}
                                >
                                  {t("voluntaryClose")}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <VoluntaryCampaignDocumentsDialog
        locale={locale}
        open={volCampaignView !== null}
        onOpenChange={(next) => {
          if (!next) setVolCampaignView(null);
        }}
        campaignLabel={volCampaignView?.label ?? ""}
        requestId={volCampaignView?.id ?? null}
      />

      <AlertDialog
        open={Boolean(confirmApproveId)}
        onOpenChange={(open) => !open && setConfirmApproveId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("approveAccess")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("approveConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingTr}>
              {t("cancelEdit")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmApproveId) approve(confirmApproveId);
                setConfirmApproveId(null);
              }}
              disabled={pendingTr}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {t("approveAccess")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(confirmRevokeId)}
        onOpenChange={(open) => !open && setConfirmRevokeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeAccess")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingTr}>
              {t("cancelEdit")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRevokeId) revoke(confirmRevokeId);
                setConfirmRevokeId(null);
              }}
              disabled={pendingTr}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("revokeAccess")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "success" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200"
        : "border-border/60 bg-muted/40 text-foreground";
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl border px-3 py-3 backdrop-blur-sm",
        toneClass,
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <span className="text-2xl font-semibold tabular-nums leading-none">
        {value}
      </span>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  total,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  total: number;
  tone?: "neutral" | "success";
}) {
  const dotClass =
    tone === "success" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={cn("size-2 rounded-full", dotClass)} aria-hidden />
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <Badge variant="outline" className="font-normal">
        {count === total ? total : `${count}/${total}`}
      </Badge>
    </div>
  );
}

function EmptyHint({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/25 px-6 py-12 text-center dark:bg-muted/15">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
