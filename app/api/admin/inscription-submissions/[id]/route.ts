import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { canManageInscriptionSubmissions } from "@/lib/pedago-access";
import {
  clearSubmissionFieldAdmin,
  deleteInscriptionSubmissionAdmin,
  getInscriptionSubmissionAdminById,
  requestCandidateModificationsAdmin,
  reopenSubmissionToDraftAdmin,
  updateSubmissionFieldReviewAdmin,
  updateSubmissionReviewAdmin,
} from "@/lib/data/inscription-submissions-admin";
import type { AdminReviewStatus } from "@/lib/data/inscription-submissions-admin";
import {
  notifyInscriptionSubmissionAccepted,
  notifyInscriptionSubmissionModificationsRequested,
  notifyInscriptionSubmissionRejected,
} from "@/lib/email/inscription-candidate-notify";

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInscriptionAdmin();
  if ("response" in gate) return gate.response;
  const { id } = await params;
  const row = await getInscriptionSubmissionAdminById(gate.admin, id);
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ item: row });
}

type PatchBody =
  | {
      action: "review";
      admin_review_status: AdminReviewStatus;
      /** Omit pour ne pas écraser `reviewer_note` existant */
      reviewer_note?: string | null;
    }
  | { action: "clearField"; fieldId: string }
  | {
      action: "requestCandidateEdits";
      candidateRevisionNotice?: string | null;
    }
  | { action: "reopenDraft" }
  | {
      action: "fieldReview";
      fieldId: string;
      ok: boolean;
      message?: string | null;
    };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInscriptionAdmin();
  if ("response" in gate) return gate.response;
  const { id } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("action" in body)) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  if (body.action === "review") {
    const st = body.admin_review_status;
    if (
      st !== "pending" &&
      st !== "accepted" &&
      st !== "rejected" &&
      st !== "needs_completion"
    ) {
      return NextResponse.json({ error: "INVALID_STATUS" }, { status: 400 });
    }
    const patchInput: Parameters<typeof updateSubmissionReviewAdmin>[3] = {
      admin_review_status: st,
    };
    if (Object.prototype.hasOwnProperty.call(body, "reviewer_note")) {
      patchInput.reviewer_note = body.reviewer_note ?? null;
    }
    const res = await updateSubmissionReviewAdmin(gate.admin, id, gate.user.id, patchInput);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    const row = await getInscriptionSubmissionAdminById(gate.admin, id);
    if (row) {
      if (st === "accepted") {
        void notifyInscriptionSubmissionAccepted(row).catch((err) => {
          console.error("[api/inscription-submissions] notify accepted:", err);
        });
      } else if (st === "rejected") {
        void notifyInscriptionSubmissionRejected(row).catch((err) => {
          console.error("[api/inscription-submissions] notify rejected:", err);
        });
      }
    }
    return NextResponse.json({ ok: true, item: row });
  }

  if (body.action === "clearField") {
    const fid = typeof body.fieldId === "string" ? body.fieldId.trim() : "";
    if (!fid) {
      return NextResponse.json({ error: "FIELD_REQUIRED" }, { status: 400 });
    }
    const res = await clearSubmissionFieldAdmin(gate.admin, id, fid);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    const row = await getInscriptionSubmissionAdminById(gate.admin, id);
    return NextResponse.json({ ok: true, item: row });
  }

  if (body.action === "fieldReview") {
    const fid = typeof body.fieldId === "string" ? body.fieldId.trim() : "";
    if (!fid)
      return NextResponse.json({ error: "FIELD_REQUIRED" }, { status: 400 });
    if (typeof body.ok !== "boolean") {
      return NextResponse.json({ error: "OK_REQUIRED" }, { status: 400 });
    }
    const ok = body.ok;
    const res = await updateSubmissionFieldReviewAdmin(
      gate.admin,
      id,
      fid,
      ok,
      typeof body.message === "string" ? body.message : undefined,
    );
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    const row = await getInscriptionSubmissionAdminById(gate.admin, id);
    return NextResponse.json({ ok: true, item: row });
  }

  if (body.action === "requestCandidateEdits") {
    const rawMsg = (
      body as { candidateRevisionNotice?: string | null }
    ).candidateRevisionNotice;
    const msg =
      typeof rawMsg === "string"
        ? rawMsg
        : rawMsg === null || rawMsg === undefined
          ? ""
          : "";
    const res = await requestCandidateModificationsAdmin(gate.admin, id, {
      candidateRevisionNotice: msg,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    const row = await getInscriptionSubmissionAdminById(gate.admin, id);
    if (row) {
      void notifyInscriptionSubmissionModificationsRequested(row).catch((err) => {
        console.error("[api/inscription-submissions] notify modifications:", err);
      });
    }
    return NextResponse.json({ ok: true, item: row });
  }

  if (body.action === "reopenDraft") {
    const res = await reopenSubmissionToDraftAdmin(gate.admin, id);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    const row = await getInscriptionSubmissionAdminById(gate.admin, id);
    return NextResponse.json({ ok: true, item: row });
  }

  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireInscriptionAdmin();
  if ("response" in gate) return gate.response;
  const { id } = await params;

  const res = await deleteInscriptionSubmissionAdmin(gate.admin, id);
  if (!res.ok) {
    const status =
      res.error === "NOT_FOUND" ? 404 : res.error === "INVALID_ID" ? 400 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
