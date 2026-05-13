import { notFound } from "next/navigation";
import { AddSanctionForm } from "@/components/sanctions/add-sanction-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { retireSanctionAction } from "@/app/actions/sanctions";
import {
  fetchClassById,
  fetchSanctionsForStudent,
  fetchStudentById,
} from "@/lib/data/school";
import { sanctionTypeLabel } from "@/lib/sanction-labels";
import {
  canDownloadSanctionPdf,
  canRemoveSanction,
  canViewRemovedHistory,
  hasPermission,
  sanctionsForStudentProfile,
} from "@/lib/permissions";
import { getSessionUser } from "@/lib/session-server";
import type { AppLocale } from "@/i18n/routing";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getTranslations } from "next-intl/server";

export default async function StudentProfilePage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const user = await getSessionUser();
  const student = await fetchStudentById(params.id);
  if (!student || !user) {
    notFound();
  }

  const tStudent = await getTranslations({
    locale: params.locale,
    namespace: "student",
  });
  const tSanctions = await getTranslations({
    locale: params.locale,
    namespace: "sanctions",
  });
  const dateLocale = params.locale === "fr" ? fr : enUS;
  const clazz = student.classId
    ? await fetchClassById(student.classId)
    : null;

  const dbSanctions = await fetchSanctionsForStudent(student.id);
  const sanctions = sanctionsForStudentProfile(
    user,
    student.classId,
    dbSanctions,
  );

  const canPdf = canDownloadSanctionPdf(user, student.classId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">
          {tStudent("title", {
            first: student.firstName,
            last: student.lastName,
          })}
        </h1>
        <p className="text-muted-foreground">
          {clazz?.name ?? "—"} · {student.email}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{tStudent("generalInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Entrée :{" "}
              {student.entryDate
                ? format(new Date(student.entryDate), "PP", {
                    locale: dateLocale,
                  })
                : "—"}
            </p>
            <p className="text-muted-foreground">{tStudent("inactiveLogin")}</p>
          </CardContent>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          {hasPermission(user, "ADD_SANCTION") && (
            <AddSanctionForm studentId={student.id} locale={params.locale} />
          )}
          <Card>
            <CardHeader>
              <CardTitle>{tStudent("sanctions")}</CardTitle>
              <CardDescription className="space-y-2 text-pretty">
                <span className="block">{tStudent("sanctionsHistoryHint")}</span>
                <span className="block text-xs text-muted-foreground">
                  {tSanctions("pdfSent")}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sanctions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {tStudent("sanctionsEmpty")}
                </p>
              )}
              {sanctions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold capitalize">
                          {sanctionTypeLabel(
                            s.type,
                            params.locale === "en" ? "en" : "fr",
                          )}
                        </p>
                        <Badge
                          variant={
                            s.status === "active" ? "default" : "secondary"
                          }
                          className="capitalize"
                        >
                          {s.status === "active"
                            ? tSanctions("statusActive")
                            : tSanctions("statusRetired")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.date), "PP pp", {
                          locale: dateLocale,
                        })}
                      </p>
                      {s.authorName.trim() ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tStudent("sanctionByAuthor", {
                            author: s.authorName,
                          })}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm text-muted-foreground">
                        {s.description}
                      </p>
                      {s.status === "retired" &&
                        (canViewRemovedHistory(user) ||
                          (user.role === "PROF_PRINCIPAL" &&
                            user.principalClassIds?.includes(
                              student.classId,
                            ))) && (
                          <p className="mt-2 text-xs italic text-muted-foreground">
                            {tSanctions("retiredMeta", {
                              name: s.retiredByName ?? "—",
                              date: format(
                                new Date(s.retiredAt ?? s.date),
                                "PP pp",
                                { locale: dateLocale },
                              ),
                            })}
                          </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      {canPdf && (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={`/api/pdf/sanction?id=${encodeURIComponent(s.id)}&locale=${params.locale}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {tStudent("pdfDownload")}
                          </a>
                        </Button>
                      )}
                      {canRemoveSanction(user, s, student.classId) &&
                        s.status === "active" && (
                          <form action={retireSanctionAction}>
                            <input
                              type="hidden"
                              name="sanctionId"
                              value={s.id}
                            />
                            <input
                              type="hidden"
                              name="studentId"
                              value={student.id}
                            />
                            <input
                              type="hidden"
                              name="locale"
                              value={params.locale}
                            />
                            <Button type="submit" variant="secondary" size="sm">
                              {tStudent("removeSanction")}
                            </Button>
                          </form>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
