import { AdminBackLink } from "@/components/admin/admin-back-link";
import { StudentAdminDetailForm } from "@/components/admin/student-admin-detail-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchStudentAdminDetail } from "@/lib/data/students-admin";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";

export default async function AdminStudentDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const [detail, classOptions] = await Promise.all([
    fetchStudentAdminDetail(params.id),
    fetchAdminClassOptions(),
  ]);

  if (!detail) {
    notFound();
  }

  const ts = await getTranslations({
    locale: params.locale,
    namespace: "admin.students",
  });

  return (
    <div className="space-y-6">
      <AdminBackLink href="/admin/students" label={ts("backToList")} />
      <div>
        <h1 className="text-3xl font-semibold">
          {ts("detailTitle", {
            name: `${detail.firstName} ${detail.lastName}`,
          })}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {detail.className ? <span>{detail.className}</span> : null}
          {detail.age != null ? (
            <span>
              {ts("ageLabel")} : {detail.age}
            </span>
          ) : null}
          {detail.birthDate ? <span>{detail.birthDate}</span> : null}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{ts("formSectionTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentAdminDetailForm
            locale={params.locale}
            initial={detail}
            classOptions={classOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
