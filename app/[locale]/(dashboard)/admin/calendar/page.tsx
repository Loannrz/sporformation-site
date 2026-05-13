import { SchoolCalendarCreateForm } from "@/components/admin/school-calendar-create-form";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { fetchStudentsMinimalForCalendar } from "@/lib/data/calendar";
import {
  fetchAdminClassOptions,
  formatCloudClassDisplayName,
} from "@/lib/data/school";
import { fetchAllStaffForAdmin } from "@/lib/data/staff-admin";
import { redirectToAccessDenied } from "@/lib/guards";
import { isStaffAdmin } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const tAdmin = await getTranslations({
    locale: params.locale,
    namespace: "admin",
  });
  const tPage = await getTranslations({
    locale: params.locale,
    namespace: "admin.calendarSchool",
  });

  const [staff, classesRaw, studentOpts] = await Promise.all([
    fetchAllStaffForAdmin(),
    fetchAdminClassOptions(),
    fetchStudentsMinimalForCalendar(),
  ]);

  const teachers = staff.map((s) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName}`.trim(),
  }));

  const classes = classesRaw.map((c) => ({
    id: c.id,
    label: formatCloudClassDisplayName(
      c.name,
      c.academicYearStart,
      c.academicYearEnd,
    ),
  }));

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin" label={tAdmin("backToAdmin")} />

      <div>
        <h1 className="text-3xl font-semibold">{tPage("pageTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{tPage("pageSubtitle")}</p>
      </div>

      <SchoolCalendarCreateForm
        locale={params.locale}
        teachers={teachers}
        classes={classes}
        students={studentOpts}
      />
    </div>
  );
}
