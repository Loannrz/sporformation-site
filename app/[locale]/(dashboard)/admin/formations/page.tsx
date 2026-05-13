import { EmptyState } from "@/components/ui/empty-state";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { BookOpen } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function AdminProgramsPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const t = await getTranslations({
    locale: params.locale,
    namespace: "admin.programs",
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <EmptyState
        icon={BookOpen}
        title={t("emptyTitle")}
        description={t("emptyDesc")}
        action={
          <Button type="button" variant="outline" asChild>
            <Link href="/admin">{t("backHub")}</Link>
          </Button>
        }
      />
    </div>
  );
}
