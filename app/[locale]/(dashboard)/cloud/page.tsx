import { getTranslations } from "next-intl/server";
import { CloudExplorer } from "@/components/cloud/cloud-explorer";
import { CloudUploadDocumentButton } from "@/components/cloud/cloud-upload-document-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppLocale } from "@/i18n/routing";
import {
  attachSignedUrlsToCloudFiles,
  fetchAdminClassOptions,
  fetchAllCloudExplorerFiles,
  fetchCloudExplorerFolders,
  fetchCloudStudentUploadOptions,
  formatCloudClassDisplayName,
} from "@/lib/data/school";
import {
  teacherCloudScopedClassIds,
  viewerHasEstablishmentCloudScope,
} from "@/lib/cloud-teacher-scope";
import { getSessionUser } from "@/lib/session-server";
import { redirect } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function CloudPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "cloud",
  });

  if (!user) {
    return null;
  }

  if (user.role === "ELEVE") {
    if (!user.studentClassId) {
      return (
        <Card className="border-none bg-transparent shadow-none">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-2xl font-semibold">{t("title")}</CardTitle>
            <CardDescription>{t("studentNoClassMessage")}</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    redirect({
      href: `/cloud/classe-${user.studentClassId}`,
      locale: params.locale,
    });
  }

  const scopedClassIds = teacherCloudScopedClassIds(user);
  const establishmentScope = viewerHasEstablishmentCloudScope(user);

  const folders = await fetchCloudExplorerFolders(user.role, {
    ...(scopedClassIds != null
      ? {
          teacherScopedClassIds: scopedClassIds,
          viewerId: user.id,
          ...(user.role === "PROF_PRINCIPAL"
            ? { principalClassIds: user.principalClassIds ?? [] }
            : {}),
        }
      : {}),
  });
  const allDocsRaw = await fetchAllCloudExplorerFiles(user.role, {
    ...(scopedClassIds != null
      ? { teacherScopedClassIds: scopedClassIds, viewerId: user.id }
      : {}),
  });
  const allDocuments = await attachSignedUrlsToCloudFiles(allDocsRaw);

  const classOptsRaw = await fetchAdminClassOptions();
  const classOptsFiltered =
    scopedClassIds != null
      ? classOptsRaw.filter((c) => scopedClassIds.includes(c.id))
      : classOptsRaw;
  const studentOptions = await fetchCloudStudentUploadOptions(
    scopedClassIds != null ? { restrictClassIds: scopedClassIds } : undefined,
  );
  const classOptions = classOptsFiltered.map((c) => ({
    id: c.id,
    label: formatCloudClassDisplayName(
      c.name,
      c.academicYearStart,
      c.academicYearEnd,
    ),
  }));

  return (
    <div className="space-y-8">
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="flex flex-col gap-4 space-y-0 px-0 pt-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-3xl font-semibold">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </div>
          <CloudUploadDocumentButton
            locale={params.locale}
            viewer={{ firstName: user.firstName, lastName: user.lastName }}
            classOptions={classOptions}
            studentOptions={studentOptions}
            defaultClassId={null}
          />
        </CardHeader>
      </Card>
      <CloudExplorer
        locale={params.locale}
        viewerId={user.id}
        viewerIsDirector={establishmentScope}
        hideExplorerSearch={!establishmentScope}
        showTeacherExplorerTab={establishmentScope}
        classOptions={classOptions}
        studentOptions={studentOptions}
        classFolders={folders.classes}
        teacherFolders={folders.teachers}
        studentFolders={folders.students}
        allDocuments={allDocuments}
      />
    </div>
  );
}
