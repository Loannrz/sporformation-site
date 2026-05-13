"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchStudentById, fetchClassById } from "@/lib/data/school";
import { canRemoveSanction, hasPermission } from "@/lib/permissions";
import { emailSanctionPdfToDirector } from "@/lib/email/sanction";
import { SanctionOfficialPdf } from "@/lib/pdf/sanction-official";
import type { AppLocale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/session-server";
import type { SanctionType } from "@/types";

export async function addSanctionAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "ADD_SANCTION")) {
    throw new Error("Unauthorized");
  }

  const studentId = String(formData.get("studentId") ?? "");
  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";
  const type = String(formData.get("type") ?? "autre") as SanctionType;
  const description = String(formData.get("description") ?? "").trim();

  const student = await fetchStudentById(studentId);
  if (!student || !description) {
    throw new Error("Invalid payload");
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("sanctions")
    .insert({
      student_id: studentId,
      type,
      description,
      author_id: user.id,
      status: "active",
    })
    .select("id, occurred_at")
    .single();

  if (insertErr || !inserted) {
    throw new Error(insertErr?.message ?? "Insert failed");
  }

  const cls = student.classId
    ? await fetchClassById(student.classId)
    : null;

  const authorName = `${user.firstName} ${user.lastName}`;
  const pdfLocale: "fr" | "en" = locale === "en" ? "en" : "fr";
  const pdfBuffer = await renderToBuffer(
    <SanctionOfficialPdf
      locale={pdfLocale}
      schoolName="SPORFORMATION"
      studentFirst={student.firstName}
      studentLast={student.lastName}
      classNameLabel={cls?.name ?? "—"}
      sanctionTypeLabel={type}
      dateLabel={new Date(inserted.occurred_at).toLocaleString(
        pdfLocale === "fr" ? "fr-FR" : "en-US",
      )}
      description={description}
      authorName={authorName}
    />,
  );

  await emailSanctionPdfToDirector({
    pdfBuffer: pdfBuffer as Buffer,
    filename: `sanction-${inserted.id}.pdf`,
    studentName: `${student.firstName} ${student.lastName}`,
  });

  revalidatePath(`/${locale}/etudiants/${studentId}`);
  if (student.classId) {
    revalidatePath(`/${locale}/classes/${student.classId}`);
  }
  revalidatePath(`/${locale}/dashboard`);
}

export async function retireSanctionAction(formData: FormData) {
  const user = await getSessionUser();
  const sanctionId = String(formData.get("sanctionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";

  const supabase = await createServerSupabase();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: row, error: fetchErr } = await supabase
    .from("sanctions")
    .select("id,status,student_id")
    .eq("id", sanctionId)
    .maybeSingle();

  const student = await fetchStudentById(studentId);

  if (!user || fetchErr || !row || !student || row.student_id !== studentId) {
    throw new Error("Invalid");
  }

  const tempSanction = {
    id: row.id,
    studentId: row.student_id,
    type: "autre" as const,
    date: new Date().toISOString(),
    description: "",
    authorId: "",
    authorName: "",
    status: row.status === "retired" ? ("retired" as const) : ("active" as const),
    attachments: [],
  };

  if (!canRemoveSanction(user, tempSanction, student.classId || undefined)) {
    throw new Error("Forbidden");
  }

  const { error: updateErr } = await supabase
    .from("sanctions")
    .update({
      status: "retired",
      retired_at: new Date().toISOString(),
      retired_by: user.id,
    })
    .eq("id", sanctionId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  revalidatePath(`/${locale}/etudiants/${studentId}`);
  if (student.classId) {
    revalidatePath(`/${locale}/classes/${student.classId}`);
  }
  revalidatePath(`/${locale}/dashboard`);
}
