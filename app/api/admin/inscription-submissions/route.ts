import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { canManageInscriptionSubmissions } from "@/lib/pedago-access";
import { listInscriptionSubmissionsAdmin } from "@/lib/data/inscription-submissions-admin";
import type {
  AdminReviewStatus,
  ListInscriptionSubmissionsParams,
  SubmissionStatusPortal,
} from "@/lib/data/inscription-submissions-admin";

export const dynamic = "force-dynamic";

async function requireInscriptionAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>; admin: NonNullable<Awaited<ReturnType<typeof createAdminSupabase>>> }
  | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user || !canManageInscriptionSubmissions(user)) {
    return { response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }
  const admin = createAdminSupabase();
  if (!admin) {
    return { response: NextResponse.json({ error: "NO_ADMIN" }, { status: 503 }) };
  }
  return { user, admin };
}

function parseListParams(url: URL) {
  const page = Math.min(500, Math.max(1, Number(url.searchParams.get("page")) || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 25));
  const status = (url.searchParams.get("status") ?? "all") as
    | SubmissionStatusPortal
    | "all";
  const formationSlug = url.searchParams.get("formation") ?? undefined;
  const villeSlug = url.searchParams.get("ville") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const sortRaw = url.searchParams.get("sort") ?? "updated_desc";
  const sort: ListInscriptionSubmissionsParams["sort"] =
    sortRaw === "updated_asc" || sortRaw === "submitted_desc" ? sortRaw : "updated_desc";
  const rs = url.searchParams.get("review") ?? "all";
  const reviewStatus =
    rs === "pending" ||
    rs === "accepted" ||
    rs === "rejected" ||
    rs === "needs_completion" ||
    rs === "none"
      ? (rs as AdminReviewStatus | "none")
      : ("all" as const);

  return {
    page,
    pageSize,
    status:
      status === "draft" || status === "submitted" ? status : ("all" as const),
    formationSlug: formationSlug ?? undefined,
    villeSlug: villeSlug ?? undefined,
    q: q ?? undefined,
    sort,
    reviewStatus: reviewStatus === "all" || reviewStatus === "none" ? reviewStatus : reviewStatus,
  };
}

/** Liste paginée des dossiers inscription (session staff + service role serveur). */
export async function GET(request: Request) {
  const gate = await requireInscriptionAdmin();
  if ("response" in gate) return gate.response;

  const url = new URL(request.url);
  const p = parseListParams(url);

  const { rows, total } = await listInscriptionSubmissionsAdmin(gate.admin, {
    page: p.page,
    pageSize: p.pageSize,
    status: p.status,
    formationSlug: p.formationSlug,
    villeSlug: p.villeSlug,
    q: p.q,
    sort: p.sort,
    reviewStatus: p.reviewStatus,
  });

  return NextResponse.json({
    page: p.page,
    pageSize: p.pageSize,
    total,
    items: rows.map(({ template_definition: _omitDef, ...rest }) => rest),
  });
}
