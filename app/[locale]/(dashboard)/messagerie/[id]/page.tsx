import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MOCK_CONVERSATIONS } from "@/lib/mock-data";
import type { AppLocale } from "@/i18n/routing";

export default async function ConversationPage({
  params,
}: {
  params: { locale: AppLocale; id: string };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "messaging",
  });
  const conv = MOCK_CONVERSATIONS.find((c) => c.id === params.id);
  if (!conv) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {conv.isGroup ? conv.name : "Conversation"}
        </h1>
        <p className="text-sm text-muted-foreground">{t("searchPlaceholder")}</p>
      </div>
      <Card className="flex-1 border-border/80">
        <CardHeader>
          <CardTitle className="text-base">{conv.lastMessageSnippet}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <Bubble side="them" content="Réunion mouvements ? Je propose 17h." />
            <Bubble side="me" content="Confirmé pour 17h, j’envoie l’ordre du jour tout à l’heure." />
            <Bubble side="them" content="Parfait, besoin aussi des présences mercredi." />
          </div>
          <div className="flex gap-2">
            <Input placeholder="Écrire un message…" />
            <button
              type="button"
              className="rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Envoyer
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Bubble({
  side,
  content,
}: {
  side: "me" | "them";
  content: string;
}) {
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-4 py-2 ${
        side === "me"
          ? "ml-auto bg-primary text-primary-foreground"
          : "bg-muted text-foreground"
      }`}
    >
      {content}
    </div>
  );
}
