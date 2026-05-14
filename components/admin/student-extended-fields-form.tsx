"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  STUDENT_EXTENDED_COLUMNS,
  type StudentExtendedColumn,
} from "@/lib/students-extended-fields";

export type StudentExtendedFormState = Partial<
  Record<StudentExtendedColumn, string | null>
>;

type Props = {
  values: StudentExtendedFormState;
  onChange: (next: StudentExtendedFormState) => void;
  idPrefix: string;
  /** Sections en plus, à part : phone, address… */
  defaultOpen?: boolean;
};

/** Sections d’affichage (cosmétique uniquement). */
const SECTIONS: Array<{
  titleKey: string;
  cols: StudentExtendedColumn[];
}> = [
  {
    titleKey: "extSectionFormation",
    cols: ["promo", "of_name", "formation_number", "diploma", "njs", "tep"],
  },
  {
    titleKey: "extSectionBirth",
    cols: ["birth_country", "birth_department"],
  },
  {
    titleKey: "extSectionContact",
    cols: [
      "phone",
      "address_line1",
      "address_line2",
      "postal_code",
      "address_city",
      "address_country",
    ],
  },
  {
    titleKey: "extSectionStatus",
    cols: ["employment_status", "parcoursup", "validation_status"],
  },
  {
    titleKey: "extSectionUC",
    cols: ["uc1_status", "uc2_status", "uc3_status", "uc4_status"],
  },
];

export function StudentExtendedFieldsForm({
  values,
  onChange,
  idPrefix,
  defaultOpen = false,
}: Props) {
  const t = useTranslations("admin.students");

  const setField = (col: StudentExtendedColumn, v: string) => {
    onChange({ ...values, [col]: v });
  };

  const labelKey = (col: StudentExtendedColumn): string => {
    const map: Record<StudentExtendedColumn, string> = {
      njs: "extNjs",
      promo: "extPromo",
      of_name: "extOfName",
      formation_number: "extFormationNumber",
      diploma: "extDiploma",
      tep: "extTep",
      birth_country: "extBirthCountry",
      birth_department: "extBirthDepartment",
      phone: "extPhone",
      address_line1: "extAddressLine1",
      address_line2: "extAddressLine2",
      postal_code: "extPostalCode",
      address_city: "extAddressCity",
      address_country: "extAddressCountry",
      employment_status: "extEmploymentStatus",
      parcoursup: "extParcoursup",
      validation_status: "extValidationStatus",
      uc1_status: "extUc1",
      uc2_status: "extUc2",
      uc3_status: "extUc3",
      uc4_status: "extUc4",
    };
    return map[col];
  };

  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-border/70 bg-muted/20 dark:bg-muted/10"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium hover:bg-muted/30">
        <span>{t("extToggleTitle")}</span>
        <ChevronDown
          className="h-4 w-4 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-5 border-t border-border/60 p-4">
        <p className="text-xs text-muted-foreground">{t("extHint")}</p>
        {SECTIONS.map((s) => (
          <section key={s.titleKey} className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(s.titleKey)}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.cols.map((col) => {
                const id = `${idPrefix}-${col}`;
                return (
                  <div key={col} className="space-y-1.5">
                    <Label htmlFor={id} className="text-xs">
                      {t(labelKey(col))}
                    </Label>
                    <Input
                      id={id}
                      value={values[col] ?? ""}
                      onChange={(e) => setField(col, e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}

export function emptyStudentExtended(): StudentExtendedFormState {
  const out: StudentExtendedFormState = {};
  for (const c of STUDENT_EXTENDED_COLUMNS) out[c] = "";
  return out;
}

export function extendedFromAdmin(
  ext: Partial<Record<StudentExtendedColumn, string | null>> | undefined,
): StudentExtendedFormState {
  const out = emptyStudentExtended();
  if (!ext) return out;
  for (const c of STUDENT_EXTENDED_COLUMNS) {
    out[c] = ext[c] ?? "";
  }
  return out;
}

export function extendedToInput(
  v: StudentExtendedFormState,
): Partial<Record<StudentExtendedColumn, string | null>> {
  const out: Partial<Record<StudentExtendedColumn, string | null>> = {};
  for (const c of STUDENT_EXTENDED_COLUMNS) {
    const raw = v[c];
    out[c] = raw && raw.trim() ? raw.trim() : null;
  }
  return out;
}
