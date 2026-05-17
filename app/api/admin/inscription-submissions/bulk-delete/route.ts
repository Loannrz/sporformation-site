import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { canManageInscriptionSubmissions } from "@/lib/pedago-access";
import { bulkDeleteAcceptedInscriptionSubmissionsAdmin } from "@/lib/data/inscription-submissions-admin";

export const dynamic = "force-dynamic";

async function requireInscriptionAdmin(): Promise<
  | { admin: NonNullable<Awaited<ReturnType<typeof createAdminSupabase>>> }
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
  return { admin };
}

/** Suppression groupée réservée aux dossiers « Envoyés » avec décision « Accepté » (file correspondante). */
export async function POST(request: Request) {
  const gate = await requireInscriptionAdmin();
  if ("response" in gate) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const idsRaw = body && typeof body === "object" && body !== null ? (body as { ids?: unknown }).ids : undefined;
  if (!Array.isArray(idsRaw)) {
    return NextResponse.json({ error: "IDS_REQUIRED" }, { status: 400 });
  }

  const ids = idsRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);

  const result = await bulkDeleteAcceptedInscriptionSubmissionsAdmin(gate.admin, ids);
  if (!result.ok) {
    const status =
      result.error === "NO_IDS"
        ? 400
        : result.error === "LOAD_FAILED"
          ? 400
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    deleted: result.deleted,
    skippedNotEligible: result.skippedNotEligible,
    failed: result.failed,
  });
}
