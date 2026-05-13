import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function CloudFolderPage({
  params,
}: {
  params: { locale: AppLocale; dossier: string };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "cloud",
  });
  const label = decodeURIComponent(params.dossier);

  return (
    <div className="space-y-6">
      <Link
        href="/cloud"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("title")}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{label}</CardTitle>
          <CardDescription>{t("versioning")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Prévisualisation PDF & images : branchez Supabase Storage et signez
            les URLs pour activer le viewer intégré.
          </p>
          <Separator />
          <ul className="space-y-2">
            <li>• planning_classe_v3.pdf — v3 — il y a 2 h</li>
            <li>• compte_rendu.docx — v1 — hier</li>
            <li>• photo_championnat.webp — v1 — lundi</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
