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
import { CloudDeleteTeacherFolderButton } from "@/components/cloud/cloud-delete-teacher-folder-button";
import { CloudFolderFileBrowser } from "@/components/cloud/cloud-folder-file-browser";
import { CloudUploadDocumentButton } from "@/components/cloud/cloud-upload-document-button";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  teacherCloudScopedClassIds,
  viewerHasEstablishmentCloudScope,
} from "@/lib/cloud-teacher-scope";
import {
  attachSignedUrlsToCloudFiles,
  collectStudentDepositAccessibleFolderIds,
  fetchAdminClassOptions,
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
  resolveStudentClassCloudDepositScope,
  studentMayAccessClassCloudDepositFolder,
} from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";
import { mayCreateStudentInboxSubfolder } from "@/lib/roles";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";

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

  let studentDepositNav:
    | { landingFolderId: string; accessibleFolderIds: string[] }
    | undefined;

  if (user.role === "ELEVE" && parsed?.kind === "class") {
    const depositScope = resolveStudentClassCloudDepositScope(classFolderRows);
    if (!depositScope.landingFolderId) {
      notFound();
    }
    studentDepositNav = {
      landingFolderId: depositScope.landingFolderId,
      accessibleFolderIds: collectStudentDepositAccessibleFolderIds(
        classFolderRows,
        depositScope,
      ),
    };
    if (!currentFolderId) {
      redirect({
        href: `/cloud/${encodeURIComponent(params.dossier)}?folder=${depositScope.landingFolderId}`,
        locale: params.locale,
      });
    }
    if (
      !studentMayAccessClassCloudDepositFolder(classFolderRows, currentFolderId)
    ) {
      redirect({
        href: `/cloud/${encodeURIComponent(params.dossier)}?folder=${depositScope.landingFolderId}`,
        locale: params.locale,
      });
    }
  }

  const folderTree =
    parsed?.kind === "class" ? buildClassCloudFolderTree(classFolderRows) : [];

  const folderPick =
    parsed?.kind === "class"
      ? user.role === "ELEVE"
        ? flattenClassCloudStudentInboxOptions(
            folderTree,
            t("studentInboxPlacementRoot"),
          ).filter((opt) =>
            studentDepositNav
              ? studentDepositNav.accessibleFolderIds.includes(opt.id)
              : false,
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
    currentFolderId !== null &&
    (user.role === "ELEVE" && studentDepositNav
      ? studentDepositNav.accessibleFolderIds.includes(currentFolderId)
      : isClassFolderInStudentUploadTree(classFolderRows, currentFolderId));
  const allowTeacherInboxSubfolder =
    parsed?.kind === "class" &&
    Boolean(currentFolderId) &&
    inStudentDepositZone &&
    mayCreateStudentInboxSubfolder(user, parsed.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/55 bg-muted/20 px-4 py-3.5 shadow-sm backdrop-blur-sm dark:bg-muted/10 sm:px-5">
        <Link
          href="/cloud"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition hover:bg-background/80 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {t("title")}
        </Link>
        {user.role === "ELEVE" ? (
          folderPick.length > 0 ? (
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
          folderLinkBase={folderLinkBase}
          currentFolderId={currentFolderId}
          classFolderRows={classFolderRows}
          subfolders={subfolders}
          files={files}
          viewerId={user.id}
          viewerIsDirector={viewerIsDirector}
          viewerStudentId={user.role === "ELEVE" ? user.studentId ?? null : null}
          classOptions={classOptions}
          studentOptions={studentOptions}
          folderSlug={params.dossier}
          folderOptionsForClass={{ classId: parsed.id, options: folderPick }}
          studentDepositNav={studentDepositNav}
          studentSubfolderCreate={
            allowTeacherInboxSubfolder && currentFolderId
              ? { classId: parsed.id, parentFolderId: currentFolderId }
              : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden rounded-2xl border-border/65 shadow-lg shadow-black/[0.03] ring-1 ring-black/[0.03] dark:shadow-black/25 dark:ring-white/[0.06]">
          <CardHeader className="border-b border-border/50 bg-gradient-to-br from-muted/35 via-muted/15 to-transparent pb-6 dark:from-muted/25">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  {displayTitle}
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  {parsed?.kind === "student"
                    ? t("folderStudentDepositSubtitle")
                    : t("folderDetailSubtitle")}
                </CardDescription>
              </div>
              {parsed?.kind === "teacher" &&
              viewerIsDirector &&
              files.length > 0 ? (
                <CloudDeleteTeacherFolderButton
                  locale={params.locale}
                  ownerId={parsed.id}
                  teacherFolderLabel={displayTitle}
                  fileCount={files.length}
                />
              ) : null}
            </div>
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
                viewerStudentId={
                  user.role === "ELEVE" ? user.studentId ?? null : null
                }
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
