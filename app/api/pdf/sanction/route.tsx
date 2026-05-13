import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { MOCK_CLASSES, MOCK_SANCTIONS, MOCK_STUDENTS } from "@/lib/mock-data";
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

  const sanction = MOCK_SANCTIONS.find((s) => s.id === id);
  const student = sanction
    ? MOCK_STUDENTS.find((stu) => stu.id === sanction.studentId)
    : undefined;

  if (!sanction || !student) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const cls = MOCK_CLASSES.find((c) => c.id === student.classId);

  const stamp = await renderToBuffer(
    <SanctionOfficialPdf
      locale={locale}
      schoolName="SPORFORMATION"
      studentFirst={student.firstName}
      studentLast={student.lastName}
      classNameLabel={cls?.name ?? "—"}
      sanctionTypeLabel={sanction.type}
      dateLabel={new Date(sanction.date).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}
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
