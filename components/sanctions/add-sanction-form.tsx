"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SANCTION_FORM_TYPES_ORDER } from "@/lib/discipline-types";
import type { SanctionType } from "@/types";
import { addSanctionAction } from "@/app/actions/sanctions";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  studentId: string;
  locale: AppLocale;
  /** Dans une carte parente : pas de cadre ni titre dupliqué. */
  embedded?: boolean;
};

export function AddSanctionForm({ studentId, locale, embedded }: Props) {
  const t = useTranslations("sanctions");
  const tTypes = useTranslations("sanctions.types");
  const tCommon = useTranslations("common");

  return (
    <form
      action={addSanctionAction}
      className={
        embedded ? "space-y-4" : "space-y-4 rounded-xl border border-border bg-card p-6"
      }
    >
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="locale" value={locale} />
      {!embedded ? (
        <h3 className="text-sm font-semibold">{t("composeTitle")}</h3>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="stype">{t("formType")}</Label>
        <select
          id="stype"
          name="type"
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          defaultValue="avertissement"
        >
          {SANCTION_FORM_TYPES_ORDER.map((ty: SanctionType) => (
            <option key={ty} value={ty}>
              {tTypes(ty)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sdesc">{t("formDetail")}</Label>
        <Textarea
          required
          id="sdesc"
          name="description"
          minLength={4}
          className="min-h-[120px]"
        />
      </div>

      <Button type="submit">{tCommon("save")}</Button>
    </form>
  );
}
