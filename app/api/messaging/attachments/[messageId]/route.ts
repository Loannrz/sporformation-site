import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/session-server";
import { userParticipatesInConversation } from "@/lib/data/messaging";

function contentDispositionAttachment(filename: string): string {
  const safe =
    filename.replace(/\r?\n/g, " ").trim().slice(0, 240) ||
    "piece-jointe";
  const ascii =
    /^[a-zA-Z0-9._\- ]+$/.test(safe) && !/[;"]/.test(safe)
      ? safe
      : "attachment";
  return `attachment; filename="${ascii.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

/** Téléchargement autorisé aux participants du fil uniquement (fichier servi depuis Storage). */
export async function GET(
  _request: Request,
  { params }: { params: { messageId: string } },
) {
  const msgId = params.messageId;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      msgId,
    )
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const user = await getSessionUser();
  if (!user) {
    return new NextResponse(null, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return new NextResponse(null, { status: 503 });
  }

  const { data: row, error } = await admin
    .from("messages")
    .select(
      "conversation_id,attachment_path,attachment_filename,attachment_mime",
    )
    .eq("id", msgId)
    .maybeSingle();

  if (error || !row) {
    return new NextResponse(null, { status: 404 });
  }

  const path = String(
    (row as { attachment_path?: string | null }).attachment_path ?? "",
  ).trim();
  const filename =
    String(
      (row as { attachment_filename?: string | null }).attachment_filename ?? "",
    ).trim() || "piece-jointe";
  const mime =
    String(
      (row as { attachment_mime?: string | null }).attachment_mime ?? "",
    ).trim() || "application/octet-stream";

  if (!path) {
    return new NextResponse(null, { status: 404 });
  }

  const conversationId = String(
    (row as { conversation_id?: string }).conversation_id ?? "",
  );
  const participant = await userParticipatesInConversation(
    user.id,
    conversationId,
  );
  if (!participant) {
    return new NextResponse(null, { status: 403 });
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from("message_attachments")
    .download(path);

  if (dlErr || !blob) {
    return new NextResponse(null, { status: 404 });
  }

  const buf = await blob.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "private, no-store",
    },
  });
}
