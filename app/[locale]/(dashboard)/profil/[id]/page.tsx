import { notFound } from "next/navigation";
import { StaffProfileDetail } from "@/components/profile/staff-profile-detail";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchStaffByIdForAdmin } from "@/lib/data/staff-admin";
import { getSessionUser } from "@/lib/session-server";
import { canViewStaffDirectoryProfiles } from "@/lib/roles";
import type { AppLocale } from "@/i18n/routing";

export default async function ProfilePage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const viewer = await getSessionUser();
  if (!viewer || !canViewStaffDirectoryProfiles(viewer)) {
    notFound();
  }

  const [staff, classOptions] = await Promise.all([
    fetchStaffByIdForAdmin(params.id),
    fetchAdminClassOptions(),
  ]);

  if (!staff) {
    notFound();
  }

  return (
    <StaffProfileDetail
      staff={staff}
      classOptions={classOptions}
      viewer={viewer}
      locale={params.locale}
    />
  );
}
