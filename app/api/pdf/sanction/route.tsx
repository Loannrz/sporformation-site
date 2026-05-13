import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { fetchClassById, fetchSanRawById } from "@/lib/data/school";
import { canDownloadSanctionPdf } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { SanctionOfficialPdf } from "@/lib/pdf/sanction-official";
import type { AppLocale } from "@/i18n/routing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const localeRaw = request.nextUrl.searchParams.get("locale") as AppLocale;
  const locale: "fr" | "en" = localeRaw === "en" ? "en" : "fr";

  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bundle = await fetchSanRawById(id);
  if (!bundle) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { sanction, student } = bundle;
  if (!canDownloadSanctionPdf(user, student.classId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const cls = student.classId
    ? await fetchClassById(student.classId)
    : null;

  const stamp = await renderToBuffer(
    <SanctionOfficialPdf
      locale={locale}
      schoolName="SPORFORMATION"
      studentFirst={student.firstName}
      studentLast={student.lastName}
      classNameLabel={cls?.name ?? "—"}
      sanctionTypeLabel={sanction.type}
      dateLabel={new Date(sanction.date).toLocaleString(
        locale === "fr" ? "fr-FR" : "en-US",
      )}
      description={sanction.description}
      authorName={sanction.authorName}
    />,
  );

  const body = new Uint8Array(stamp);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sanction-${sanction.id}.pdf"`,
    },
  });
}
