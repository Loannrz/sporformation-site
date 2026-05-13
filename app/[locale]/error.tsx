"use client";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

export default function LocaleError({
  error: _err,
  reset,
}: {
  error: Error & { id?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-14 w-14 text-amber-500" />
      <h1 className="text-3xl font-semibold">{t("errorTitle")}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("errorBody")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset}>
          {t("retry")}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">{t("backDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
