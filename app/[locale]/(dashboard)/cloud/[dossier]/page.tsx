import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CloudClassFolderPageBody } from "@/components/cloud/cloud-class-folder-page-body";
import { CloudFolderFileBrowser } from "@/components/cloud/cloud-folder-file-browser";
import { CloudUploadDocumentButton } from "@/components/cloud/cloud-upload-document-button";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { deriveClassFolderDefaultAudienceTab } from "@/lib/cloud-document-audience";
import {
  teacherCloudScopedClassIds,
  viewerHasEstablishmentCloudScope,
} from "@/lib/cloud-teacher-scope";
import {
  attachSignedUrlsToCloudFiles,
  fetchAdminClassOptions,
  fetchClassCloudAudienceIndex,
  fetchCloudFolderFiles,
  fetchCloudStudentUploadOptions,
  fetchStudentClassIdForCloud,
  fetchClassCloudFoldersFlat,
  buildClassCloudFolderTree,
  flattenClassCloudFolderOptions,
  flattenClassCloudStudentInboxOptions,
  filterClassCloudFoldersByParent,
  formatCloudClassDisplayName,
  getStudentInboxFolderId,
  isClassFolderInStudentUploadTree,
  parseCloudFolderSlug,
  resolveCloudFolderHeading,
} from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";
import { mayCreateStudentInboxSubfolder } from "@/lib/roles";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CloudFolderPage({
  params,
  searchParams,
}: {
  params: { locale: AppLocale; dossier: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const parsed = parseCloudFolderSlug(params.dossier);
  if (user.role === "ELEVE") {
    if (
      parsed?.kind !== "class" ||
      !user.studentClassId ||
      parsed.id !== user.studentClassId
    ) {
      notFound();
    }
  }

  const scopedClassIds = teacherCloudScopedClassIds(user);
  const establishmentScope = viewerHasEstablishmentCloudScope(user);

  let studentFolderClassId: string | null = null;

  if (!establishmentScope && user.role !== "ELEVE" && parsed) {
    if (parsed.kind === "class") {
      if (!scopedClassIds?.includes(parsed.id)) notFound();
    } else if (parsed.kind === "student") {
      studentFolderClassId = await fetchStudentClassIdForCloud(parsed.id);
      if (!studentFolderClassId || !scopedClassIds?.includes(studentFolderClassId))
        notFound();
    } else if (parsed.kind === "teacher") {
      if (parsed.id !== user.id) notFound();
    }
  }

  const folderParamRaw = searchParams?.folder;
  const folderParam = Array.isArray(folderParamRaw)
    ? folderParamRaw[0]
    : folderParamRaw;
  const currentFolderId =
    folderParam && UUID_RE.test(folderParam.trim())
      ? folderParam.trim()
      : null;

  const t = await getTranslations({
    locale: params.locale,
    namespace: "cloud",
  });
  const { title } = await resolveCloudFolderHeading(params.dossier);

  const classFolderRows =
    parsed?.kind === "class"
      ? await fetchClassCloudFoldersFlat(parsed.id)
      : [];

  const folderTree =
    parsed?.kind === "class" ? buildClassCloudFolderTree(classFolderRows) : [];

  const folderPick =
    parsed?.kind === "class"
      ? user.role === "ELEVE"
        ? flattenClassCloudStudentInboxOptions(
            folderTree,
            t("studentInboxPlacementRoot"),
          )
        : flattenClassCloudFolderOptions(folderTree, t("uploadFolderRoot"))
      : [];

  const subfolders =
    parsed?.kind === "class"
      ? filterClassCloudFoldersByParent(classFolderRows, currentFolderId)
      : [];

  const filesRaw = parsed
    ? await fetchCloudFolderFiles(
        parsed.kind,
        parsed.id,
        parsed.kind === "class"
          ? { classFolderId: currentFolderId, viewerRole: user.role }
          : { viewerRole: user.role },
      )
    : [];
  const files = await attachSignedUrlsToCloudFiles(filesRaw);

  const audienceIndexRows =
    parsed?.kind === "class"
      ? await fetchClassCloudAudienceIndex(parsed.id, user.role)
      : [];

  const initialAudienceTab = deriveClassFolderDefaultAudienceTab(
    audienceIndexRows.map((r) => r.cloudAudience),
  );

  const classOptsRaw = await fetchAdminClassOptions();
  const scopedForPicker =
    user.role === "ELEVE" && user.studentClassId
      ? classOptsRaw.filter((c) => c.id === user.studentClassId)
      : scopedClassIds != null
        ? classOptsRaw.filter((c) => scopedClassIds.includes(c.id))
        : classOptsRaw;
  const classOptions = scopedForPicker.map((c) => ({
    id: c.id,
    label: formatCloudClassDisplayName(
      c.name,
      c.academicYearStart,
      c.academicYearEnd,
    ),
  }));

  const studentOptions =
    user.role === "ELEVE"
      ? []
      : await fetchCloudStudentUploadOptions(
          scopedClassIds != null
            ? { restrictClassIds: scopedClassIds }
            : undefined,
        );

  let defaultClassId: string | null =
    parsed?.kind === "class" ? parsed.id : null;
  const defaultStudentId: string | null =
    parsed?.kind === "student" ? parsed.id : null;
  if (parsed?.kind === "student") {
    defaultClassId =
      studentFolderClassId ??
      (await fetchStudentClassIdForCloud(parsed.id));
  }

  const viewerIsDirector = establishmentScope;

  const folderLinkBase = `/cloud/${encodeURIComponent(params.dossier)}`;
  const currentFolderName = currentFolderId
    ? (classFolderRows.find((r) => r.id === currentFolderId)?.name ?? null)
    : null;
  const displayTitle =
    currentFolderName && parsed?.kind === "class"
      ? `${title} · ${currentFolderName}`
      : title;

  const inboxFolderId =
    parsed?.kind === "class" ? getStudentInboxFolderId(classFolderRows) : null;
  const inStudentDepositZone =
    parsed?.kind === "class" &&
    isClassFolderInStudentUploadTree(classFolderRows, currentFolderId);
  const allowTeacherInboxSubfolder =
    parsed?.kind === "class" &&
    Boolean(currentFolderId) &&
    inStudentDepositZone &&
    mayCreateStudentInboxSubfolder(user, parsed.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/cloud"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("title")}
        </Link>
        {user.role === "ELEVE" ? (
          inStudentDepositZone && folderPick.length > 0 ? (
            <CloudUploadDocumentButton
              locale={params.locale}
              viewer={{ firstName: user.firstName, lastName: user.lastName }}
              classOptions={classOptions}
              studentOptions={[]}
              studentDeposit
              depositButtonLabel={t("studentDepositUploadButton")}
              forcedClassId={parsed?.kind === "class" ? parsed.id : null}
              defaultClassId={parsed?.kind === "class" ? parsed.id : null}
              depositFolderPickOptions={
                parsed?.kind === "class"
                  ? { classId: parsed.id, options: folderPick }
                  : undefined
              }
              defaultClassFolderId={
                parsed?.kind === "class"
                  ? (currentFolderId ??
                      inboxFolderId ??
                      folderPick[0]?.id) ?? undefined
                  : undefined
              }
              folderSlug={params.dossier}
            />
          ) : null
        ) : (
          <CloudUploadDocumentButton
            locale={params.locale}
            viewer={{ firstName: user.firstName, lastName: user.lastName }}
            classOptions={classOptions}
            studentOptions={studentOptions}
            defaultClassId={defaultClassId}
            defaultStudentId={defaultStudentId}
            folderSlug={params.dossier}
            folderOptionsForClass={
              parsed?.kind === "class"
                ? { classId: parsed.id, options: folderPick }
                : undefined
            }
            defaultClassFolderId={
              parsed?.kind === "class"
                ? currentFolderId
                  ? currentFolderId
                  : "__root__"
                : undefined
            }
          />
        )}
      </div>
      {parsed?.kind === "class" ? (
        <CloudClassFolderPageBody
          locale={params.locale}
          viewerRole={user.role}
          displayTitle={displayTitle}
          subtitle={t("folderDetailSubtitleClass")}
          folderLinkBase={folderLinkBase}
          currentFolderId={currentFolderId}
          classFolderRows={classFolderRows}
          audienceIndexRows={audienceIndexRows}
          subfolders={subfolders}
          files={files}
          viewerId={user.id}
          viewerIsDirector={viewerIsDirector}
          classOptions={classOptions}
          studentOptions={studentOptions}
          folderSlug={params.dossier}
          folderOptionsForClass={{ classId: parsed.id, options: folderPick }}
          initialAudienceTab={initialAudienceTab}
          studentSubfolderCreate={
            allowTeacherInboxSubfolder && currentFolderId
              ? { classId: parsed.id, parentFolderId: currentFolderId }
              : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/15 pb-6">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {displayTitle}
            </CardTitle>
            <CardDescription className="text-base">
              {t("folderDetailSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-6 sm:p-8">
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("folderNoDocuments")}
              </p>
            ) : (
              <CloudFolderFileBrowser
                files={files}
                locale={params.locale}
                viewerId={user.id}
                viewerIsDirector={viewerIsDirector}
                classOptions={classOptions}
                studentOptions={studentOptions}
                folderSlug={params.dossier}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
