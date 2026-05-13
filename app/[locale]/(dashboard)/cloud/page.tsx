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
import { getSessionUser } from "@/lib/session-server";

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

  const folders = await fetchCloudExplorerFolders();
  const allDocsRaw = await fetchAllCloudExplorerFiles();
  const allDocuments = await attachSignedUrlsToCloudFiles(allDocsRaw);

  const classOptsRaw = await fetchAdminClassOptions();
  const studentOptions = await fetchCloudStudentUploadOptions();
  const classOptions = classOptsRaw.map((c) => ({
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
        viewerIsDirector={user.role === "DIRECTEUR"}
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
