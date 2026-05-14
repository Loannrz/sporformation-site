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
import { Badge } from "@/components/ui/badge";
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
import {
  ClipboardList,
  LayoutDashboard,
  Mail,
  School,
  UserRound,
} from "lucide-react";

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

      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-muted/25 p-6 shadow-sm dark:from-primary/12 dark:to-card sm:p-8">
        <div
          className="pointer-events-none absolute -left-10 -bottom-24 h-52 w-52 rounded-full bg-primary/8 blur-3xl dark:bg-primary/12"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar className="h-28 w-28 shrink-0 border-4 border-background shadow-lg ring-2 ring-primary/15 dark:border-card">
              {detail.photoUrl ? (
                <AvatarImage src={detail.photoUrl} alt="" />
              ) : null}
              <AvatarFallback className="bg-primary/12 text-xl font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <Badge variant="secondary" className="w-fit font-normal">
                {ts("overviewBadge")}
              </Badge>
              <h1 className="text-balance text-3xl font-semibold tracking-tight">
                {detail.firstName} {detail.lastName}
              </h1>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{detail.email ?? ts("emailMissing")}</span>
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <StudentAdminEditDossierDialog
              locale={params.locale}
              initial={detail}
              classOptions={classOptions}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden border-border/70 shadow-md lg:col-span-2 dark:border-border/80">
          <CardHeader className="flex flex-row items-start gap-4 border-b border-border/60 bg-muted/[0.35] pb-5 dark:bg-muted/15">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/60 dark:bg-card">
              <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-xl font-semibold">
                {ts("overviewDisciplineTitle")}
              </CardTitle>
              <CardDescription className="text-[0.9375rem] leading-relaxed">
                {ts("overviewDisciplineHint")}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/40 to-transparent px-4 py-4 dark:from-muted/20">
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {detail.sanctionsTotal}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {ts("sanctionsTotalLabel")}
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent px-4 py-4 dark:from-primary/15">
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-primary">
                  {detail.sanctionsActive}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {ts("sanctionsActiveLabel")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/40 to-transparent px-4 py-4 dark:from-muted/20">
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {detail.sanctionsRetard}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {ts("sanctionsRetardLabel")}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
              <Link href={`/etudiants/${detail.id}`}>
                <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden />
                {ts("viewFullProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 shadow-md dark:border-border/80">
          <CardHeader className="flex flex-row items-start gap-4 border-b border-border/60 bg-muted/[0.35] pb-5 dark:bg-muted/15">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/60 dark:bg-card">
              <School className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <CardTitle className="text-xl font-semibold pt-1">
              {ts("overviewClassTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("classLabel")}
              </p>
              <p className="mt-2 font-semibold leading-snug">
                {detail.className ?? ts("classNone")}
              </p>
            </div>
            <div className="border-t border-border/50 pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("principalLabel")}
              </p>
              <p className="mt-2 font-medium leading-snug">
                {detail.principalDisplayName ?? ts("principalUnset")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-md dark:border-border/80">
        <CardHeader className="flex flex-row items-start gap-4 border-b border-border/60 bg-muted/[0.35] pb-5 dark:bg-muted/15 sm:gap-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/60 dark:bg-card">
            <UserRound className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl font-semibold">
              {ts("overviewIdentityTitle")}
            </CardTitle>
            <CardDescription className="text-[0.9375rem] leading-relaxed">
              {ts("overviewIdentityHint")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-transparent px-1 py-0 sm:border-border/40 sm:bg-muted/15 sm:p-4 dark:sm:bg-muted/10">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("birthDateLabel")}
              </dt>
              <dd className="mt-2 text-[0.9375rem] font-medium">
                {formatDateQuiet(detail.birthDate, dateLocale)}
                {detail.age != null ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    ({ts("ageYears", { age: detail.age })})
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="rounded-xl border border-transparent px-1 py-0 sm:border-border/40 sm:bg-muted/15 sm:p-4 dark:sm:bg-muted/10">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("sexLabel")}
              </dt>
              <dd className="mt-2 text-[0.9375rem] font-medium">{sexLabel}</dd>
            </div>
            <div className="rounded-xl border border-transparent px-1 py-0 sm:border-border/40 sm:bg-muted/15 sm:p-4 dark:sm:bg-muted/10">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("birthPlaceLabel")}
              </dt>
              <dd className="mt-2 text-[0.9375rem] font-medium">
                {detail.birthPlace ?? "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-transparent px-1 py-0 sm:border-border/40 sm:bg-muted/15 sm:p-4 dark:sm:bg-muted/10">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("entryDateLabel")}
              </dt>
              <dd className="mt-2 text-[0.9375rem] font-medium">
                {formatDateQuiet(detail.entryDate, dateLocale)}
              </dd>
            </div>
            <div className="rounded-xl border border-transparent px-1 py-0 sm:col-span-2 sm:border-border/40 sm:bg-muted/15 sm:p-4 lg:col-span-1 dark:sm:bg-muted/10">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {ts("emailLabel")}
              </dt>
              <dd className="mt-2 break-all text-[0.9375rem] font-medium">
                {detail.email ?? "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
