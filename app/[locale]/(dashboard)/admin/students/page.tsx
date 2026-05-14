import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AdminStudentsSearchableList } from "@/components/admin/admin-students-searchable-list";
import { CreateStudentModal } from "@/components/admin/create-student-modal";
import { ImportStudentsModal } from "@/components/admin/import-students-modal";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchAllStudentsForAdmin } from "@/lib/data/students-admin";
import { getSessionUser } from "@/lib/session-server";
import { isDirector, isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function AdminStudentsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const ts = await getTranslations({
    locale: params.locale,
    namespace: "admin.students",
  });

  const [students, classOptions] = await Promise.all([
    fetchAllStudentsForAdmin(),
    fetchAdminClassOptions(),
  ]);

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin" label={t("backToAdmin")} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{ts("pageTitle")}</h1>
          <p className="max-w-prose text-muted-foreground">{ts("listSubtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportStudentsModal
            locale={params.locale}
            classOptions={classOptions}
          />
          <CreateStudentModal
            locale={params.locale}
            classOptions={classOptions}
          />
        </div>
      </div>

      <AdminStudentsSearchableList
        locale={params.locale}
        students={students}
        canBulkDelete={isDirector(user)}
      />
    </div>
  );
}
