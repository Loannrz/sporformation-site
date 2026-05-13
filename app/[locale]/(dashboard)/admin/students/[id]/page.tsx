import { AdminBackLink } from "@/components/admin/admin-back-link";
import { StudentAdminEditDossierDialog } from "@/components/admin/student-admin-edit-dossier-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchAdminClassOptions } from "@/lib/data/school";
import { fetchStudentAdminDetail } from "@/lib/data/students-admin";
import { getSessionUser } from "@/lib/session-server";
import { isStaffAdmin } from "@/lib/roles";
import { redirectToAccessDenied } from "@/lib/guards";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { format, parseISO } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { School, UserRound, AlertTriangle } from "lucide-react";

function formatDateQuiet(
  iso: string | null,
  dateLocale: typeof fr | typeof enUS,
): string {
  if (!iso) return "—";
  try {
    const d =
      iso.length === 10 ? parseISO(`${iso}T12:00:00`) : parseISO(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return format(d, "PP", { locale: dateLocale });
  } catch {
    return iso;
  }
}

export default async function AdminStudentDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  if (!user || !isStaffAdmin(user)) {
    redirectToAccessDenied(params.locale);
  }

  const [detail, classOptions] = await Promise.all([
    fetchStudentAdminDetail(params.id),
    fetchAdminClassOptions(),
  ]);

  if (!detail) {
    notFound();
  }

  const ts = await getTranslations({
    locale: params.locale,
    namespace: "admin.students",
  });

  const dateLocale = params.locale === "fr" ? fr : enUS;
  const initials =
    `${detail.firstName?.[0] ?? ""}${detail.lastName?.[0] ?? ""}`.trim() ||
    "?";

  const sexLabel = (() => {
    if (!detail.sex) return ts("sexUnset");
    if (detail.sex === "M") return ts("sexM");
    if (detail.sex === "F") return ts("sexF");
    if (detail.sex === "X") return ts("sexX");
    return detail.sex;
  })();

  return (
    <div className="space-y-8">
      <AdminBackLink href="/admin/students" label={ts("backToList")} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-24 w-24 shrink-0 border-2 border-border shadow-sm">
            {detail.photoUrl ? (
              <AvatarImage src={detail.photoUrl} alt="" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ts("overviewBadge")}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {detail.firstName} {detail.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {detail.email ?? ts("emailMissing")}
            </p>
          </div>
        </div>
        <StudentAdminEditDossierDialog
          locale={params.locale}
          initial={detail}
          classOptions={classOptions}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">
                {ts("overviewDisciplineTitle")}
              </CardTitle>
            </div>
            <CardDescription>{ts("overviewDisciplineHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/25 px-4 py-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {detail.sanctionsTotal}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ts("sanctionsTotalLabel")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/25 px-4 py-3">
                <p className="text-2xl font-semibold tabular-nums text-primary">
                  {detail.sanctionsActive}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ts("sanctionsActiveLabel")}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/25 px-4 py-3">
                <p className="text-2xl font-semibold tabular-nums">
                  {detail.sanctionsRetard}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ts("sanctionsRetardLabel")}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              asChild
            >
              <Link href={`/etudiants/${detail.id}`}>
                {ts("viewFullProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <School className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">
                {ts("overviewClassTitle")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("classLabel")}
              </p>
              <p className="mt-1 font-medium">
                {detail.className ?? ts("classNone")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("principalLabel")}
              </p>
              <p className="mt-1 font-medium">
                {detail.principalDisplayName ?? ts("principalUnset")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg">
              {ts("overviewIdentityTitle")}
            </CardTitle>
          </div>
          <CardDescription>{ts("overviewIdentityHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("birthDateLabel")}
              </dt>
              <dd className="mt-1">
                {formatDateQuiet(detail.birthDate, dateLocale)}
                {detail.age != null ? (
                  <span className="ml-2 text-muted-foreground">
                    ({ts("ageYears", { age: detail.age })})
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("sexLabel")}
              </dt>
              <dd className="mt-1">{sexLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("birthPlaceLabel")}
              </dt>
              <dd className="mt-1">{detail.birthPlace ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("entryDateLabel")}
              </dt>
              <dd className="mt-1">
                {formatDateQuiet(detail.entryDate, dateLocale)}
              </dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("emailLabel")}
              </dt>
              <dd className="mt-1 break-all">{detail.email ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
