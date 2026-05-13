import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { allStaff } from "@/lib/mock-data";
import { getSessionUser } from "@/lib/session-server";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function ProfilePage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const viewer = await getSessionUser();
  const staff = allStaff.find((s) => s.id === params.id);
  if (!viewer || !staff) {
    notFound();
  }

  const tp = await getTranslations({
    locale: params.locale,
    namespace: "profiles",
  });
  const tc = await getTranslations({
    locale: params.locale,
    namespace: "common",
  });

  const dateLocale = params.locale === "fr" ? fr : enUS;
  const initials = `${staff.firstName[0]}${staff.lastName[0]}`;
  const roleHuman =
    staff.role === "DIRECTEUR"
      ? tc("roleDirector")
      : staff.role === "PROF_PRINCIPAL"
        ? tc("rolePrincipal")
        : tc("roleTeacher");

  const roleLabel = tp("subtitle", {
    role: roleHuman,
    joined: staff.joinedAt
      ? format(new Date(staff.joinedAt), "PP", { locale: dateLocale })
      : "—",
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Card className="border-none bg-transparent shadow-none">
        <CardContent className="flex flex-col gap-6 px-0 sm:flex-row">
          <Avatar className="h-24 w-24 border border-border">
            {staff.avatarUrl ? (
              <AvatarImage alt="" src={staff.avatarUrl} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-3">
            <div>
              <h1 className="text-3xl font-semibold">
                {staff.firstName} {staff.lastName}
              </h1>
              <p className="text-muted-foreground">{staff.email}</p>
            </div>
            <p className="text-sm text-muted-foreground">{staff.bio}</p>
            <p className="text-xs uppercase tracking-wide text-primary">
              {roleLabel}
            </p>
            {staff.subjects && staff.subjects.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-3">
                {staff.subjects.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vie à l&apos;école</CardTitle>
          <CardDescription>
            Logs de connexion : {viewer.role === "DIRECTEUR" ? "visibles pour vous uniquement après branchement Supabase." : "masqués — contactez la direction pour export conformité RGPD."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
