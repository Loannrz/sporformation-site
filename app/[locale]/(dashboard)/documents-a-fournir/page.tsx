import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/session-server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AppLocale } from "@/i18n/routing";
import { TeacherDocumentsToProvidePanel } from "@/components/teacher-documents/teacher-documents-to-provide-panel";

export const dynamic = "force-dynamic";

export default async function DocumentsToProvidePage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  const t = await getTranslations({
    locale: params.locale,
    namespace: "teacherDocuments",
  });

  if (!user) {
    redirect({ href: "/login", locale: params.locale });
    return null;
  }

  if (user.role !== "PROFESSEUR" && user.role !== "PROF_PRINCIPAL") {
    redirect({ href: "/dashboard", locale: params.locale });
  }

  if (!user.teacherDocumentsGateActive) {
    redirect({ href: "/dashboard", locale: params.locale });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return (
      <div className="text-sm text-muted-foreground">{t("configError")}</div>
    );
  }

  const { data: rows, error } = await supabase
    .from("teacher_document_requests")
    .select("id, label, description, sort_order, file_id")
    .eq("teacher_profile_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("loadError")}
      </div>
    );
  }

  const list = rows ?? [];
  const fileIds = list
    .map((r) => r.file_id as string | null)
    .filter((x): x is string => Boolean(x));

  let fileTitles: Record<string, string> = {};
  if (fileIds.length) {
    const { data: files } = await supabase
      .from("files")
      .select("id, title")
      .in("id", fileIds);
    fileTitles = Object.fromEntries(
      (files ?? []).map((f) => [f.id as string, (f.title as string) || ""]),
    );
  }

  const requests = list.map((r) => ({
    id: r.id as string,
    label: r.label as string,
    description: (r.description as string | null) ?? null,
    sort_order: (r.sort_order as number) ?? 0,
    file_id: (r.file_id as string | null) ?? null,
    file_title: r.file_id ? fileTitles[r.file_id as string] ?? null : null,
  }));

  const bundleSubmittedAt = user.teacherDocumentsBundleSubmittedAt ?? null;

  return (
    <TeacherDocumentsToProvidePanel
      locale={params.locale}
      requests={requests}
      bundleSubmittedAt={bundleSubmittedAt}
    />
  );
}
