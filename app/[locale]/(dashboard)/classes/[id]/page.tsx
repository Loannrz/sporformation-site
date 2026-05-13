import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MOCK_CLASSES,
  MOCK_SANCTIONS,
  MOCK_STUDENTS,
  allStaff,
} from "@/lib/mock-data";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function ClassDetailPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const cls = MOCK_CLASSES.find((c) => c.id === params.id);
  if (!cls) {
    notFound();
  }

  const tClasses = await getTranslations({
    locale: params.locale,
    namespace: "classes",
  });
  const locale = params.locale === "fr" ? fr : enUS;

  const principal = cls.principalId
    ? allStaff.find((s) => s.id === cls.principalId)
    : undefined;

  const students = MOCK_STUDENTS.filter((s) => s.classId === cls.id);

  const classSanctions = MOCK_SANCTIONS.filter((s) =>
    students.some((stu) => stu.id === s.studentId),
  ).slice(0, 10);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/classes" className="hover:text-primary">
            ← {tClasses("title")}
          </Link>
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <h1 className="text-4xl font-semibold">{cls.name}</h1>
          {principal ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {tClasses("principal")} :
              </span>
              <Badge variant="secondary">
                {principal.firstName} {principal.lastName}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{tClasses("students")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {students.map((s) => (
              <Link
                href={`/etudiants/${s.id}`}
                key={s.id}
                className="rounded-xl border border-border bg-muted/40 p-4 transition hover:border-primary/40 hover:bg-muted/60"
              >
                <p className="font-medium">
                  {s.firstName} {s.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fichiers</CardTitle>
            <CardDescription>{tClasses("files")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Espace dossier aligné avec le bucket `classes/{cls.id}`.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tClasses("sanctions")}</CardTitle>
          <CardDescription>Fil discipline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {classSanctions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Pas encore de signalement cette semaine.
            </p>
          )}
          {classSanctions.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-border/80 px-4 py-3 text-sm"
            >
              <p className="font-semibold capitalize">{s.type}</p>
              <p className="text-muted-foreground">
                {format(new Date(s.date), "PP · HH:mm", { locale })}
              </p>
              <p className="mt-2 text-muted-foreground">{s.description}</p>
              <Badge className="mt-2 capitalize" variant="outline">
                {s.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
