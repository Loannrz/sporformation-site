"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SanctionType } from "@/types";
import { addSanctionAction } from "@/app/actions/sanctions";
import type { AppLocale } from "@/i18n/routing";

type Props = {
  studentId: string;
  locale: AppLocale;
};

const TYPES: SanctionType[] = [
  "retard",
  "absence",
  "comportement",
  "autre",
];

export function AddSanctionForm({ studentId, locale }: Props) {
  const t = useTranslations("sanctions");
  const tTypes = useTranslations("sanctions.types");
  const tCommon = useTranslations("common");

  return (
    <form
      action={addSanctionAction}
      className="space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="locale" value={locale} />
      <h3 className="text-sm font-semibold">{t("composeTitle")}</h3>

      <div className="space-y-2">
        <Label htmlFor="stype">{t("formType")}</Label>
        <select
          id="stype"
          name="type"
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
          defaultValue="retard"
        >
          {TYPES.map((ty) => (
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
