"use client";

import { useTranslations } from "next-intl";
import { Folder, GraduationCap, Palette, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SessionUser } from "@/types";
import { MOCK_CLASSES } from "@/lib/mock-data";

type Props = {
  viewer: SessionUser;
};

/** Maquette explorateur : regroupements par classe, matière, intervenant et dossiers libres. */
export function CloudExplorer({ viewer: _viewer }: Props) {
  void _viewer;
  const t = useTranslations("cloud");
  const teachers = ["Mehdi Lafont", "Élodie Marchand", "Camille Renard"];

  return (
    <Tabs defaultValue="class" className="w-full space-y-6">
      <TabsList className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-0">
        <TabsTrigger value="class" className="gap-2 text-xs md:text-sm">
          <GraduationCap className="h-4 w-4" />
          {t("tabsClass")}
        </TabsTrigger>
        <TabsTrigger value="subject" className="gap-2 text-xs md:text-sm">
          <Palette className="h-4 w-4" />
          {t("tabsSubject")}
        </TabsTrigger>
        <TabsTrigger value="teacher" className="gap-2 text-xs md:text-sm">
          <User className="h-4 w-4" />
          {t("tabsTeacher")}
        </TabsTrigger>
        <TabsTrigger value="free" className="gap-2 text-xs md:text-sm">
          <Folder className="h-4 w-4" />
          {t("tabsFree")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="class">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_CLASSES.slice(0, 12).map((c) => (
            <ExplorerCard
              key={c.id}
              title={c.name}
              href={`/cloud/${encodeURIComponent(`classe-${c.id}`)}`}
              subtitle="PDF · DOCX · XLSX · images"
              meta={t("maxSize")}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="subject">
        <div className="grid gap-4 md:grid-cols-2">
          {["Sciences", "Sport", "Langues", "Management"].map((s) => (
            <ExplorerCard
              key={s}
              title={s}
              href={`/cloud/${encodeURIComponent(`matière-${s}`)}`}
              subtitle="Documents partagés"
              meta=""
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="teacher">
        <div className="grid gap-4 md:grid-cols-2">
          {teachers.map((name) => (
            <ExplorerCard
              key={name}
              title={name}
              href={`/cloud/${encodeURIComponent(`prof-${name}`)}`}
              subtitle="Partages nominatifs"
              meta=""
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="free">
        <div className="rounded-2xl border border-dashed border-primary/35 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          <p>{t("dropzone")}</p>
          <p className="mt-2 text-xs">{t("onlyDirectorDeletes")}</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function ExplorerCard({
  title,
  subtitle,
  href,
  meta,
}: {
  title: string;
  subtitle: string;
  href: string;
  meta: string;
}) {
  const t = useTranslations("cloud");

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft dark:hover:shadow-soft-dark">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          {meta ? (
            <p className="mt-2 text-[11px] text-muted-foreground">{meta}</p>
          ) : null}
        </div>
      </div>
      <Link
        href={href}
        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
      >
        {t("openFolder")}
      </Link>
    </div>
  );
}
