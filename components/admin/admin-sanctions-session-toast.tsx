"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  locale: AppLocale;
  /** Incrémenté par `fetchAdminSanctionsNewCount` pour le personnel administration. */
  count: number;
};

/** Une fois par session navigateur tant que des sanctions sont « nouvelles ». */
export function AdminSanctionsSessionToast({ locale, count }: Props) {
  const t = useTranslations("admin.sanctionsHub");

  useEffect(() => {
    if (count <= 0) return;
    const key = `sf-admin-sanctions-toast:${locale}`;
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) {
      return;
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, "1");
    }
    toast.message(t("toastNewSanctions", { count }), {
      duration: 6500,
    });
  }, [count, locale, t]);

  return null;
}
