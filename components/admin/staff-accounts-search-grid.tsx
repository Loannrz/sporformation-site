"use client";

import { StaffAccountCard } from "@/components/admin/staff-account-card";
import { Input } from "@/components/ui/input";
import type { AdminClassOption } from "@/lib/data/school";
import type { StaffAdminRow } from "@/lib/data/staff-admin";
import type { AppLocale } from "@/i18n/routing";
import type { UserRole } from "@/types";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

function roleLabel(
  t: (key: string) => string,
  role: UserRole,
): string {
  switch (role) {
    case "DIRECTEUR":
      return t("roleDirector");
    case "ADMINISTRATEUR":
      return t("roleAdministrator");
    case "PROF_PRINCIPAL":
      return t("rolePrincipal");
    case "PROFESSEUR":
      return t("roleTeacher");
    default:
      return role;
  }
}

function staffMatchesSearch(
  staff: StaffAdminRow,
  query: string,
  translatedRole: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const blob = [
    staff.firstName,
    staff.lastName,
    `${staff.firstName} ${staff.lastName}`,
    staff.email,
    staff.role,
    translatedRole,
    ...(staff.subjects ?? []),
    staff.bio ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return blob.includes(q);
}

type Props = {
  staff: StaffAdminRow[];
  locale: AppLocale;
  viewerId: string;
  viewerRole: UserRole;
  classOptions: AdminClassOption[];
};

export function StaffAccountsSearchGrid({
  staff,
  locale,
  viewerId,
  viewerRole,
  classOptions,
}: Props) {
  const t = useTranslations("admin.accounts");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      staff.filter((s) =>
        staffMatchesSearch(s, query, roleLabel(t, s.role)),
      ),
    [staff, query, t],
  );

  const showNoResults = staff.length > 0 && filtered.length === 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="sr-only" htmlFor="staff-accounts-search">
          {t("listSearchLabel")}
        </label>
        <div className="relative max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="staff-accounts-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("listSearchPlaceholder")}
            autoComplete="off"
            className="h-10 border-border/80 bg-background pl-9 shadow-sm"
          />
        </div>
      </div>

      {showNoResults ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("listSearchNoResults")}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {filtered.map((s) => (
          <StaffAccountCard
            key={s.id}
            staff={s}
            locale={locale}
            viewerId={viewerId}
            viewerRole={viewerRole}
            classOptions={classOptions}
          />
        ))}
      </div>
    </div>
  );
}
