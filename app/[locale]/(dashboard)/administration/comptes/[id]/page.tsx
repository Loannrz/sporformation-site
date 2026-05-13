import { AdminBackLink } from "@/components/admin/admin-back-link";
import { TeacherAdminPanel } from "@/components/admin/teacher-admin-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchStaffByIdForAdmin } from "@/lib/data/staff-admin";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";

export default async function AdminTeacherDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const viewer = await getSessionUser();
  if (!viewer || !isStaffAdmin(viewer)) {
    redirectToAccessDenied(params.locale);
  }

  const [staff, classOptions] = await Promise.all([
    fetchStaffByIdForAdmin(params.id),
    fetchAdminClassOptions(),
  ]);
  if (!staff) {
    notFound();
  }

  if (
    viewer.role === "ADMINISTRATEUR" &&
    staff.role !== "PROFESSEUR" &&
    staff.role !== "PROF_PRINCIPAL"
  ) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin.accounts",
  });

  return (
    <div className="space-y-6">
      <AdminBackLink
        href="/administration/comptes"
        label={t("backToAccounts")}
      />
      <div>
        <h1 className="text-3xl font-semibold">
          {staff.firstName} {staff.lastName}
        </h1>
        <p className="text-muted-foreground">
          <Link
            href={`/profil/${staff.id}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {t("openPublicProfile")}
          </Link>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("manageCardTitle")}</CardTitle>
          <CardDescription>{t("manageCardHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TeacherAdminPanel
            locale={params.locale}
            staff={staff}
            viewerId={viewer.id}
            viewerRole={viewer.role}
            classOptions={classOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
