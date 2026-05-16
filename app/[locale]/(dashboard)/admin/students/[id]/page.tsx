import { AdminBackLink } from "@/components/admin/admin-back-link";
import { StudentAdminEditDossierDialog } from "@/components/admin/student-admin-edit-dossier-dialog";
import { StudentAdminDeleteButton } from "@/components/admin/student-admin-delete-button";
import { StudentProfileDetail } from "@/components/profile/student-profile-detail";
import {
  fetchAdminClassOptions,
  fetchSanctionsForStudent,
  fetchClassById,
  fetchStudentById,
} from "@/lib/data/school";
import { fetchStudentAdminDetail } from "@/lib/data/students-admin";
import { getSessionUser } from "@/lib/session-server";
import { isDirector } from "@/lib/roles";
import { canAccessStudentAdministration } from "@/lib/pedago-access";
import { redirectToAccessDenied } from "@/lib/guards";
import { sanctionsForStudentProfile } from "@/lib/permissions";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";

export default async function AdminStudentDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  if (!user || !canAccessStudentAdministration(user)) {
    redirectToAccessDenied(params.locale);
  }

  const [adminDetail, student, classOptions] = await Promise.all([
    fetchStudentAdminDetail(params.id),
    fetchStudentById(params.id),
    fetchAdminClassOptions(),
  ]);

  if (!adminDetail || !student) {
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

  const ts = await getTranslations({
    locale: params.locale,
    namespace: "admin.students",
  });

  const staffToolbar = (
    <>
      {isDirector(user) ? (
        <StudentAdminDeleteButton
          locale={params.locale}
          studentId={adminDetail.id}
          studentDisplayName={`${student.firstName} ${student.lastName}`}
        />
      ) : null}
      <StudentAdminEditDossierDialog
        locale={params.locale}
        initial={adminDetail}
        classOptions={classOptions}
      />
    </>
  );

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin/students" label={ts("backToList")} />
      <StudentProfileDetail
        locale={params.locale}
        viewer={user}
        student={student}
        clazz={clazz}
        sanctions={sanctions}
        staffToolbar={staffToolbar}
      />
    </div>
  );
}
