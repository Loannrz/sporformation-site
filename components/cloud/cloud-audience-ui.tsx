"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Eye, GraduationCap, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CloudDocumentAudience } from "@/lib/cloud-document-audience";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const OPTIONS: readonly {
  value: CloudDocumentAudience;
  labelKey: "audienceStudents" | "audienceStaff" | "audienceBoth";
  descKey:
    | "audienceStudentsDesc"
    | "audienceStaffDesc"
    | "audienceBothDesc";
  Icon: LucideIcon;
  iconCellClass: string;
}[] = [
  {
    value: "STUDENTS",
    labelKey: "audienceStudents",
    descKey: "audienceStudentsDesc",
    Icon: GraduationCap,
    iconCellClass:
      "bg-emerald-500/[0.12] text-emerald-900 dark:bg-emerald-950/55 dark:text-emerald-300",
  },
  {
    value: "STAFF",
    labelKey: "audienceStaff",
    descKey: "audienceStaffDesc",
    Icon: Building2,
    iconCellClass:
      "bg-amber-500/[0.12] text-amber-950 dark:bg-amber-950/55 dark:text-amber-300",
  },
  {
    value: "BOTH",
    labelKey: "audienceBoth",
    descKey: "audienceBothDesc",
    Icon: UsersRound,
    iconCellClass:
      "bg-sky-500/[0.13] text-sky-950 dark:bg-sky-950/55 dark:text-sky-300",
  },
];

export function CloudDocumentAudienceBadge({
  audience,
  className,
}: {
  audience: CloudDocumentAudience;
  className?: string;
}) {
  const t = useTranslations("cloud");
  const label =
    audience === "STUDENTS"
      ? t("audienceBadgeStudents")
      : audience === "STAFF"
        ? t("audienceBadgeStaff")
        : t("audienceBadgeBoth");
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full shrink-0 truncate text-[10px] font-normal",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export function CloudDocumentAudienceRadios({
  disabled,
  name = "cloudAudience",
  defaultValue = "BOTH",
  fieldIdPrefix,
}: {
  disabled?: boolean;
  name?: string;
  defaultValue?: CloudDocumentAudience;
  fieldIdPrefix: string;
}) {
  const t = useTranslations("cloud");

  const legendHint = t("audienceLegendHint").trim();

  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="flex items-center gap-2 px-px text-base font-semibold leading-tight tracking-tight text-foreground">
        <Eye className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span>{t("audienceLegend")}</span>
      </legend>
      {legendHint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{legendHint}</p>
      ) : null}
      <div className="space-y-2.5">
        {OPTIONS.map(({ value, labelKey, descKey, Icon, iconCellClass }) => (
          <label
            key={value}
            className={cn(
              "group flex cursor-pointer items-center gap-0 overflow-hidden rounded-xl border bg-muted/35 shadow-sm outline-none ring-offset-background transition-[border-color,box-shadow]",
              "has-[[type=radio]:checked]:border-primary has-[[type=radio]:checked]:shadow-md has-[[type=radio]:checked]:ring-2 has-[[type=radio]:checked]:ring-primary/35",
              "has-[[type=radio]:focus-visible]:ring-2 has-[[type=radio]:focus-visible]:ring-ring has-[[type=radio]:focus-visible]:ring-offset-2",
            )}
          >
            <span
              className={cn(
                "flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center px-2 sm:h-[5rem] sm:w-[5rem]",
                iconCellClass,
              )}
            >
              <Icon className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={1.5} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-3 pl-1 pr-2 sm:pl-3 sm:pr-4">
              <span className="text-base font-semibold leading-tight">{t(labelKey)}</span>
              <span className="text-[13px] leading-snug text-muted-foreground">
                {t(descKey)}
              </span>
            </span>
            <span className="flex shrink-0 self-center px-3 sm:px-4">
              <input
                type="radio"
                name={name}
                value={value}
                defaultChecked={value === defaultValue}
                className="h-[1.125rem] w-[1.125rem] cursor-pointer accent-primary"
                id={`${fieldIdPrefix}-${value}`}
              />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
