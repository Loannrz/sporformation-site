import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CloudFolderFileBrowser } from "@/components/cloud/cloud-folder-file-browser";
import { CloudUploadDocumentButton } from "@/components/cloud/cloud-upload-document-button";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import {
  attachSignedUrlsToCloudFiles,
  fetchAdminClassOptions,
  fetchCloudFolderFiles,
  formatCloudClassDisplayName,
  parseCloudFolderSlug,
  resolveCloudFolderHeading,
} from "@/lib/data/school";
import { getSessionUser } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function CloudFolderPage({
  params,
}: {
  params: { locale: AppLocale; dossier: string };
}) {
  const user = await getSessionUser();
  if (!user) {
    return null;
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "cloud",
  });
  const { title } = await resolveCloudFolderHeading(params.dossier);
  const parsed = parseCloudFolderSlug(params.dossier);
  const filesRaw = parsed
    ? await fetchCloudFolderFiles(parsed.kind, parsed.id)
    : [];
  const files = await attachSignedUrlsToCloudFiles(filesRaw);

  const classOptsRaw = await fetchAdminClassOptions();
  const classOptions = classOptsRaw.map((c) => ({
    id: c.id,
    label: formatCloudClassDisplayName(
      c.name,
      c.academicYearStart,
      c.academicYearEnd,
    ),
  }));

  const defaultClassId = parsed?.kind === "class" ? parsed.id : null;

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
        <CloudUploadDocumentButton
          locale={params.locale}
          viewer={{ firstName: user.firstName, lastName: user.lastName }}
          classOptions={classOptions}
          defaultClassId={defaultClassId}
          folderSlug={params.dossier}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{t("folderDetailSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {files.length === 0 ? (
            <p>{t("folderNoDocuments")}</p>
          ) : (
            <CloudFolderFileBrowser files={files} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
