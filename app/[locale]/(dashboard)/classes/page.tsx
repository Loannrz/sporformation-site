import { Link } from "@/i18n/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MOCK_CLASSES } from "@/lib/mock-data";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function ClassesPage({
  params,
}: {
  params: { locale: AppLocale };
}) {
  const tClasses = await getTranslations({
    locale: params.locale,
    namespace: "classes",
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">{tClasses("title")}</h1>
        <p className="text-muted-foreground">
          {tClasses("subtitle", { count: MOCK_CLASSES.length })}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MOCK_CLASSES.map((c) => (
          <Card
            key={c.id}
            className="border-border bg-card transition hover:border-primary/30"
          >
            <CardHeader>
              <CardTitle>{c.name}</CardTitle>
              <CardDescription>
                {c.studentIds.length} {tClasses("students").toLowerCase()}
              </CardDescription>
            </CardHeader>
            <Link
              href={`/classes/${c.id}`}
              className="mx-6 mb-6 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              {tClasses("sanctions")}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
