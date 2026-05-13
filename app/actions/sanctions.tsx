"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { readSessionCookie } from "@/lib/session-server";
import { canRemoveSanction, hasPermission } from "@/lib/permissions";
import {
  MOCK_CLASSES,
  MOCK_SANCTIONS,
  MOCK_STUDENTS,
  pushMockSanction,
} from "@/lib/mock-data";
import { emailSanctionPdfToDirector } from "@/lib/email/sanction";
import { SanctionOfficialPdf } from "@/lib/pdf/sanction-official";
import type { AppLocale } from "@/i18n/routing";
import type { Sanction, SanctionType } from "@/types";

export async function addSanctionAction(formData: FormData) {
  const user = await readSessionCookie();
  if (!user || !hasPermission(user, "ADD_SANCTION")) {
    throw new Error("Unauthorized");
  }

  const studentId = String(formData.get("studentId") ?? "");
  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";
  const type = String(formData.get("type") ?? "autre") as SanctionType;
  const description = String(formData.get("description") ?? "").trim();

  const student = MOCK_STUDENTS.find((s) => s.id === studentId);
  if (!student || !description) {
    throw new Error("Invalid payload");
  }

  const cls = MOCK_CLASSES.find((c) => c.id === student.classId);

  const sanction: Sanction = {
    id: `san-${crypto.randomUUID()}`,
    studentId,
    type,
    date: new Date().toISOString(),
    description,
    authorId: user.id,
    authorName: `${user.firstName} ${user.lastName}`,
    status: "active",
    attachments: [],
  };

  pushMockSanction(sanction);

  const pdfLocale: "fr" | "en" = locale === "en" ? "en" : "fr";
  const pdfBuffer = await renderToBuffer(
    <SanctionOfficialPdf
      locale={pdfLocale}
      schoolName="SPORFORMATION"
      studentFirst={student.firstName}
      studentLast={student.lastName}
      classNameLabel={cls?.name ?? "—"}
      sanctionTypeLabel={type}
      dateLabel={new Date(sanction.date).toLocaleString(
        pdfLocale === "fr" ? "fr-FR" : "en-US",
      )}
      description={sanction.description}
      authorName={sanction.authorName}
    />,
  );

  await emailSanctionPdfToDirector({
    pdfBuffer: pdfBuffer as Buffer,
    filename: `sanction-${sanction.id}.pdf`,
    studentName: `${student.firstName} ${student.lastName}`,
  });

  revalidatePath(`/${locale}/etudiants/${studentId}`);
  revalidatePath(`/${locale}/classes/${student.classId}`);
}

export async function retireSanctionAction(formData: FormData) {
  const user = await readSessionCookie();
  const sanctionId = String(formData.get("sanctionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";

  const sanction = MOCK_SANCTIONS.find((s) => s.id === sanctionId);
  const student = MOCK_STUDENTS.find((s) => s.id === studentId);

  if (!user || !sanction || !student) {
    throw new Error("Invalid");
  }

  if (!canRemoveSanction(user, sanction, student.classId)) {
    throw new Error("Forbidden");
  }

  sanction.status = "retired";
  sanction.retiredAt = new Date().toISOString();
  sanction.retiredById = user.id;
  sanction.retiredByName = `${user.firstName} ${user.lastName}`;

  revalidatePath(`/${locale}/etudiants/${studentId}`);
  revalidatePath(`/${locale}/classes/${student.classId}`);
}
