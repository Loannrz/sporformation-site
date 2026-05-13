import { AdminBackLink } from "@/components/admin/admin-back-link";
import { CreateStudentModal } from "@/components/admin/create-student-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchAllStudentsForAdmin } from "@/lib/data/students-admin";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { Link } from "@/i18n/navigation";
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
          <p className="max-w-2xl text-muted-foreground">{ts("listSubtitle")}</p>
        </div>
        <CreateStudentModal locale={params.locale} classOptions={classOptions} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {students.map((s) => (
          <Link key={s.id} href={`/admin/students/${s.id}`}>
            <Card className="h-full border-border transition hover:border-primary/40">
              <CardHeader>
                <CardTitle>
                  {s.firstName} {s.lastName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {s.className ? <p>{s.className}</p> : null}
                {s.age != null ? (
                  <p>
                    {ts("ageLabel")} : {s.age}
                  </p>
                ) : null}
                {s.email ? <p>{s.email}</p> : null}
                <p className="mt-2 font-medium text-primary">{ts("openStudent")} →</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ts("emptyList")}</p>
      ) : null}
    </div>
  );
}
