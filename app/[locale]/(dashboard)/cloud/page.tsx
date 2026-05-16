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
import { enforcePedagoNav } from "@/lib/pedago-access";
import { redirect } from "@/i18n/navigation";
import { fetchTeacherOnboardingFilesForCloud } from "@/lib/data/teacher-documents";

export const dynamic = "force-dynamic";

const EXPLORER_TABS = ["class", "teacher", "student", "all", "myTeacherDocs"] as const;

function readSearchParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function CloudPage({
  params,
  searchParams,
}: {
  params: { locale: AppLocale };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUser();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "cloud",
  });

  if (!user) {
    return null;
  }

  if (user.role !== "ELEVE") {
    enforcePedagoNav(user, params.locale, "cloud");
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

  const tabRaw = readSearchParam(searchParams?.tab);
  const initialExplorerTab = EXPLORER_TABS.includes(
    tabRaw as (typeof EXPLORER_TABS)[number],
  )
    ? (tabRaw as (typeof EXPLORER_TABS)[number])
    : undefined;

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

  const myTeacherDocuments = await fetchTeacherOnboardingFilesForCloud(user);

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
      <div className="overflow-hidden rounded-3xl border border-border/65 bg-gradient-to-br from-sky-500/[0.07] via-muted/25 to-violet-500/[0.06] p-6 shadow-md ring-1 ring-black/[0.04] dark:from-sky-500/12 dark:via-muted/15 dark:to-violet-500/10 dark:ring-white/[0.06] sm:p-8">
        <div className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold tracking-tight">
              {t("title")}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {t("subtitle")}
            </CardDescription>
          </div>
          <CloudUploadDocumentButton
            locale={params.locale}
            viewer={{ firstName: user.firstName, lastName: user.lastName }}
            classOptions={classOptions}
            studentOptions={studentOptions}
            defaultClassId={null}
          />
        </div>
      </div>
      <CloudExplorer
        locale={params.locale}
        viewer={user}
        viewerId={user.id}
        viewerIsDirector={establishmentScope}
        hideExplorerSearch={false}
        showTeacherExplorerTab={
          establishmentScope ||
          user.role === "PROFESSEUR" ||
          user.role === "PROF_PRINCIPAL"
        }
        initialExplorerTab={initialExplorerTab}
        classOptions={classOptions}
        studentOptions={studentOptions}
        classFolders={folders.classes}
        teacherFolders={folders.teachers}
        studentFolders={folders.students}
        allDocuments={allDocuments}
        myTeacherDocuments={myTeacherDocuments}
      />
    </div>
  );
}
