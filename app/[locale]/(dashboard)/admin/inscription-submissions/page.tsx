import { AdminBackLink } from "@/components/admin/admin-back-link";
import { InscriptionSubmissionsFiltersToolbar } from "@/components/admin/inscription-submissions-filters-toolbar";
import { Link } from "@/i18n/navigation";
import {
  fetchInscriptionSubmissionsDashboardStats,
  listInscriptionSubmissionsAdmin,
} from "@/lib/data/inscription-submissions-admin";
import type {
  AdminReviewStatus,
  InscriptionSubmissionReviewQuickPreset,
  ListInscriptionSubmissionsParams,
  SubmissionStatusPortal,
} from "@/lib/data/inscription-submissions-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { canManageInscriptionSubmissions } from "@/lib/pedago-access";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { StatTile } from "@/components/admin/admin-stat-tile";
import { InscriptionSubmissionsBoard } from "@/components/admin/inscription-submissions-board";
import { ClipboardList, CheckCircle2, Inbox, PhoneCall, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

const QUEUE_KEYS: readonly InscriptionSubmissionReviewQuickPreset[] = [
  "backlog",
  "waiting_candidate",
  "accepted",
];

function parseQueuePreset(
  raw: string | undefined,
): InscriptionSubmissionReviewQuickPreset | null {
  if (!raw?.trim()) return null;
  return QUEUE_KEYS.includes(raw as InscriptionSubmissionReviewQuickPreset)
    ? (raw as InscriptionSubmissionReviewQuickPreset)
    : null;
}

function spGet(searchParams: Search | undefined, key: string): string | undefined {
  const v = searchParams?.[key];
  const raw = Array.isArray(v) ? v[0] : v;
  return raw?.trim() || undefined;
}

function buildHref(
  overrides: Partial<{
    q: string;
    status: string;
    formation: string;
    ville: string;
    review: string;
    sort: string;
    page: number;
    pageSize: number;
    queue: InscriptionSubmissionReviewQuickPreset | "all" | null;
  }>,
  base?: Search,
) {
  const q = overrides.q ?? spGet(base, "q") ?? "";
  const status = overrides.status ?? spGet(base, "status") ?? "all";
  const formation = overrides.formation ?? spGet(base, "formation") ?? "";
  const ville = overrides.ville ?? spGet(base, "ville") ?? "";
  const review = overrides.review ?? spGet(base, "review") ?? "all";
  const sort = overrides.sort ?? spGet(base, "sort") ?? "updated_desc";
  const page = overrides.page ?? (Number(spGet(base, "page")) || 1);
  const pageSize = overrides.pageSize ?? (Number(spGet(base, "pageSize")) || 25);

  let queuePreset: InscriptionSubmissionReviewQuickPreset | undefined;
  if ("queue" in overrides) {
    const o = overrides.queue;
    if (o === null || o === undefined || o === "all") queuePreset = undefined;
    else queuePreset = parseQueuePreset(String(o)) ?? undefined;
  } else queuePreset = parseQueuePreset(spGet(base, "queue")) ?? undefined;

  const u = new URLSearchParams();
  if (q) u.set("q", q);
  if (status && status !== "all") u.set("status", status);
  if (formation) u.set("formation", formation);
  if (ville) u.set("ville", ville);
  if (review && review !== "all") u.set("review", review);
  if (sort && sort !== "updated_desc") u.set("sort", sort);
  if (queuePreset) u.set("queue", queuePreset);
  if (page > 1) u.set("page", String(page));
  if (pageSize !== 25) u.set("pageSize", String(pageSize));

  const qs = u.toString();
  return qs ? `/admin/inscription-submissions?${qs}` : `/admin/inscription-submissions`;
}

export default async function AdminInscriptionSubmissionsPage({
  params,
  searchParams,
}: {
  params: { locale: AppLocale };
  searchParams?: Search;
}) {
  const user = await getSessionUser();
  if (!user || !canManageInscriptionSubmissions(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const ts = await getTranslations({
    locale: params.locale,
    namespace: "admin.inscriptionSubmissions",
  });

  const admin = createAdminSupabase();
  if (!admin) {
    return (
      <div className="space-y-4">
        <AdminBackLink href="/admin" label={t("backToAdmin")} />
        <p className="text-sm text-destructive">{ts("configError")}</p>
      </div>
    );
  }

  const page = Math.max(1, Number(spGet(searchParams, "page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(spGet(searchParams, "pageSize")) || 25));
  const q = spGet(searchParams, "q");
  const statusRaw = spGet(searchParams, "status") ?? "all";
  const status: SubmissionStatusPortal | "all" =
    statusRaw === "draft" || statusRaw === "submitted" ? statusRaw : "all";
  const formationSlug = spGet(searchParams, "formation");
  const villeSlug = spGet(searchParams, "ville");
  const sortRaw = spGet(searchParams, "sort") ?? "updated_desc";
  const sort: ListInscriptionSubmissionsParams["sort"] =
    sortRaw === "updated_asc" || sortRaw === "submitted_desc" ? sortRaw : "updated_desc";
  const reviewRaw = spGet(searchParams, "review") ?? "all";
  const reviewStatus: AdminReviewStatus | "all" | "none" =
    reviewRaw === "pending" ||
    reviewRaw === "accepted" ||
    reviewRaw === "rejected" ||
    reviewRaw === "needs_completion" ||
    reviewRaw === "none"
      ? reviewRaw
      : "all";

  const queuePreset = parseQueuePreset(spGet(searchParams, "queue"));

  const [dashboard, listRes] = await Promise.all([
    fetchInscriptionSubmissionsDashboardStats(admin, {
      status,
      formationSlug,
      villeSlug,
      q,
    }),
    listInscriptionSubmissionsAdmin(admin, {
      page,
      pageSize,
      status: queuePreset ? "submitted" : status,
      formationSlug,
      villeSlug,
      q,
      sort,
      reviewQuickPreset: queuePreset ?? undefined,
      reviewStatus: queuePreset
        ? "all"
        : reviewStatus === "pending" ||
            reviewStatus === "accepted" ||
            reviewStatus === "rejected" ||
            reviewStatus === "needs_completion" ||
            reviewStatus === "none"
          ? reviewStatus
          : "all",
    }),
  ]);

  const { rows, total } = listRes;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const quickHref = {
    all: buildHref({ queue: "all", page: 1 }, searchParams),
    backlog: buildHref(
      { queue: "backlog", page: 1, status: "submitted", review: "all" },
      searchParams,
    ),
    waiting_candidate: buildHref(
      { queue: "waiting_candidate", page: 1, status: "submitted", review: "all" },
      searchParams,
    ),
    accepted: buildHref(
      { queue: "accepted", page: 1, status: "submitted", review: "all" },
      searchParams,
    ),
  } as const;

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={t("backToAdmin")} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden
        >
          <ClipboardList className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight leading-tight">{ts("pageTitle")}</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{ts("pageSubtitle")}</p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Inbox className="h-5 w-5" />}
          label={ts("dashStatTotal")}
          value={dashboard.total}
          tone="neutral"
        />
        <StatTile
          icon={<Sparkles className="h-5 w-5" />}
          label={ts("dashStatBacklog")}
          value={dashboard.backlog}
          tone="warning"
        />
        <StatTile
          icon={<PhoneCall className="h-5 w-5" />}
          label={ts("dashStatWaiting")}
          value={dashboard.waitingCandidate}
          tone="info"
        />
        <StatTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={ts("dashStatAccepted")}
          value={dashboard.accepted}
          tone="success"
        />
      </section>

      <InscriptionSubmissionsFiltersToolbar
        defaultQ={q ?? ""}
        activeQueue={queuePreset}
        quickHref={quickHref}
      />

      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
        <InscriptionSubmissionsBoard
          locale={params.locale}
          rows={rows}
          acceptedBulkDeleteEnabled={queuePreset === "accepted"}
          pagination={
            pages > 1 ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-6 text-sm">
                <span className="text-muted-foreground">
                  {ts("paginationSummary", {
                    total,
                    page,
                    pages,
                  })}
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={buildHref({ page: page - 1 }, searchParams)}
                      className="rounded-md border border-input px-3 py-2 hover:bg-muted"
                    >
                      {ts("prev")}
                    </Link>
                  ) : null}
                  {page < pages ? (
                    <Link
                      href={buildHref({ page: page + 1 }, searchParams)}
                      className="rounded-md border border-input px-3 py-2 hover:bg-muted"
                    >
                      {ts("next")}
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
