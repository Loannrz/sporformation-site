import { notFound } from "next/navigation";
import { StudentProfileDetail } from "@/components/profile/student-profile-detail";
import {
  fetchClassById,
  fetchSanctionsForStudent,
  fetchStudentById,
} from "@/lib/data/school";
import {
  sanctionsForStudentProfile,
} from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import { canViewStudentDossierPage } from "@/lib/roles";
import type { AppLocale } from "@/i18n/routing";

export default async function StudentProfilePage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  if (!user || !canViewStudentDossierPage(user)) {
    notFound();
  }

  const student = await fetchStudentById(params.id);
  if (!student) {
    notFound();
  }

  const clazz = student.classId
    ? await fetchClassById(student.classId)
    : null;

  const dbSanctions = await fetchSanctionsForStudent(student.id);
  const sanctions = sanctionsForStudentProfile(
    user,
    student.classId,
    dbSanctions,
  );

  return (
    <StudentProfileDetail
      locale={params.locale}
      viewer={user}
      student={student}
      clazz={clazz}
      sanctions={sanctions}
    />
  );
}
