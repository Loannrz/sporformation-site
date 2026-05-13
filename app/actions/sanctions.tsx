"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchStudentById, fetchClassById } from "@/lib/data/school";
import { canRemoveSanction, hasPermission } from "@/lib/permissions";
import {
  emailDisciplineClassBatchToDirector,
  emailSanctionPdfToDirector,
} from "@/lib/email/sanction";
import { SanctionOfficialPdf } from "@/lib/pdf/sanction-official";
import type { AppLocale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/session-server";
import type { SanctionType, SessionUser } from "@/types";
import { sanctionTypeLabel } from "@/lib/sanction-labels";

async function supabasePreferServiceRole() {
  return createAdminSupabase() ?? (await createServerSupabase());
}

async function applySingleStudentDiscipline(
  user: SessionUser,
  studentId: string,
  type: SanctionType,
  description: string,
  locale: AppLocale,
) {
  const student = await fetchStudentById(studentId);
  const descTrim = description.trim();
  if (!student) {
    throw new Error(
      "Student not found — check RLS/service role or the student identifier.",
    );
  }
  if (!descTrim) {
    throw new Error("Description is required");
  }

  const supabase = await supabasePreferServiceRole();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("sanctions")
    .insert({
      student_id: studentId,
      type,
      description: descTrim,
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
  const typeLabel = sanctionTypeLabel(type, pdfLocale);
  const pdfBuffer = await renderToBuffer(
    <SanctionOfficialPdf
      locale={pdfLocale}
      schoolName="SPORFORMATION"
      studentFirst={student.firstName}
      studentLast={student.lastName}
      classNameLabel={cls?.name ?? "—"}
      sanctionTypeLabel={typeLabel}
      dateLabel={new Date(inserted.occurred_at).toLocaleString(
        pdfLocale === "fr" ? "fr-FR" : "en-US",
      )}
      description={descTrim}
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

export async function addSanctionAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "ADD_SANCTION")) {
    throw new Error("Unauthorized");
  }

  const studentId = String(formData.get("studentId") ?? "");
  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";
  const type = String(formData.get("type") ?? "autre") as SanctionType;
  const description = String(formData.get("description") ?? "").trim();

  await applySingleStudentDiscipline(user, studentId, type, description, locale);
}

/** Raccourci sidebar : un élève ou toute une classe (une ligne `sanctions` par élève). */
export async function addDisciplineReportsAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user, "ADD_SANCTION")) {
    throw new Error("Unauthorized");
  }

  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";
  const type = String(formData.get("type") ?? "autre") as SanctionType;
  const description = String(formData.get("description") ?? "").trim();
  const scope = String(formData.get("scope") ?? "student");

  if (!description) {
    throw new Error("Invalid payload");
  }

  if (scope === "student") {
    const studentId = String(formData.get("studentId") ?? "");
    await applySingleStudentDiscipline(user, studentId, type, description, locale);
    return;
  }

  if (scope === "class") {
    const classId = String(formData.get("classId") ?? "");
    const clazz = await fetchClassById(classId);
    if (!clazz) {
      throw new Error("Classe inconnue");
    }
    const studentIds = clazz.studentIds;
    if (studentIds.length === 0) {
      throw new Error("Aucun élève dans cette classe");
    }

    const supabase = await supabasePreferServiceRole();
    if (!supabase) {
      throw new Error("Supabase not configured");
    }

    const rows = studentIds.map((student_id) => ({
      student_id,
      type,
      description,
      author_id: user.id,
      status: "active" as const,
    }));

    const { error: insertErr } = await supabase.from("sanctions").insert(rows);
    if (insertErr) {
      throw new Error(insertErr.message);
    }

    const pdfLocale: "fr" | "en" = locale === "en" ? "en" : "fr";
    const typeLabel = sanctionTypeLabel(type, pdfLocale);

    const { data: students } = await supabase
      .from("students")
      .select("id,first_name,last_name")
      .in("id", studentIds);
    const names =
      students
        ?.map((s) =>
          `${String(s.first_name ?? "")} ${String(s.last_name ?? "")}`.trim(),
        )
        .filter(Boolean) ?? [];

    await emailDisciplineClassBatchToDirector({
      className: clazz.name,
      count: studentIds.length,
      typeLabel,
      description,
      studentNames:
        names.length > 0
          ? names
          : studentIds.map((id) => `Élève ${id.slice(0, 8)}…`),
    });

    revalidatePath(`/${locale}/classes/${classId}`);
    revalidatePath(`/${locale}/dashboard`);
    for (const sid of studentIds) {
      revalidatePath(`/${locale}/etudiants/${sid}`);
    }
    return;
  }

  throw new Error("Invalid scope");
}

export async function retireSanctionAction(formData: FormData) {
  const user = await getSessionUser();
  const sanctionId = String(formData.get("sanctionId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const locale = (formData.get("locale") as AppLocale | null) ?? "fr";

  const supabase = await supabasePreferServiceRole();
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
    status:
      row.status === "retired" ? ("retired" as const) : ("active" as const),
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
