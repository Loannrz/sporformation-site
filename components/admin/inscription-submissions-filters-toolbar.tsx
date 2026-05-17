"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InscriptionSubmissionReviewQuickPreset } from "@/lib/data/inscription-submissions-admin";
import { CheckCircle2, Inbox, PhoneCall, Search, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

const SEARCH_DEBOUNCE_MS = 280;

export type InscriptionSubmissionQueueQuickKey =
  | "all"
  | InscriptionSubmissionReviewQuickPreset;

type Props = {
  defaultQ: string;
  /** Préréglage file d’attente — aligné sur les compteurs du tableau de bord. */
  activeQueue: InscriptionSubmissionReviewQuickPreset | null;
  /** Liens filtres rapides résolus par le serveur depuis l’URL actuelle. */
  quickHref: Record<InscriptionSubmissionQueueQuickKey, string>;
};

function ToolbarSkeleton() {
  return (
    <div
      className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 space-y-4 animate-pulse"
      aria-hidden
    >
      <div className="space-y-2">
        <div className="h-4 w-32 rounded-md bg-muted" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-[7.8rem] rounded-full bg-muted" />
          ))}
        </div>
      </div>
      <div className="h-11 w-full rounded-md bg-muted/80" />
    </div>
  );
}

function InscriptionSubmissionsFiltersToolbarUi({
  defaultQ,
  activeQueue,
  quickHref,
}: Props) {
  const ts = useTranslations("admin.inscriptionSubmissions");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const spRef = useRef(searchParams);
  spRef.current = searchParams;

  const queueLocked = activeQueue != null;
  const [draft, setDraft] = useState(defaultQ.trim());

  useEffect(() => {
    const next = searchParams.get("q")?.trim() ?? "";
    setDraft(next);
  }, [searchParams]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = draft.trim();
      const sp = spRef.current;
      const fromUrl = sp.get("q")?.trim() ?? "";
      if (trimmed === fromUrl) return;

      const u = new URLSearchParams(sp.toString());
      if (trimmed.length) {
        u.set("q", trimmed);
      } else {
        u.delete("q");
      }
      // Nouvelle recherche : repasser sur la première page (comme avant le formulaire GET).
      u.delete("page");
      const qs = u.toString();
      const href = qs.length ? `${pathname}?${qs}` : (pathname ?? "");
      startTransition(() => {
        router.replace(href);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [draft, pathname, router, startTransition]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {ts("filterQueueHeading")}
        </p>
        <div className="flex flex-wrap gap-2">
          <QueuePill href={quickHref.all} active={activeQueue == null}>
            <Inbox className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {ts("filterQuickAll")}
          </QueuePill>
          <QueuePill href={quickHref.backlog} active={activeQueue === "backlog"} tone="warning">
            <Sparkles className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {ts("filterQuickBacklog")}
          </QueuePill>
          <QueuePill
            href={quickHref.waiting_candidate}
            active={activeQueue === "waiting_candidate"}
            tone="info"
          >
            <PhoneCall className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {ts("filterQuickWaiting")}
          </QueuePill>
          <QueuePill href={quickHref.accepted} active={activeQueue === "accepted"} tone="success">
            <CheckCircle2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {ts("filterQuickAccepted")}
          </QueuePill>
        </div>
        {queueLocked ? (
          <p className="text-xs text-muted-foreground">{ts("filterQueueActiveHint")}</p>
        ) : null}
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="inscription-admin-search-q"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={ts("filterSearchInstant")}
          aria-label={ts("filterSearchInstant")}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "h-11 border-border/80 bg-muted/30 pl-10 shadow-inner",
            "placeholder:text-muted-foreground/80 focus-visible:bg-background focus-visible:ring-primary/35",
          )}
        />
      </div>
    </div>
  );
}

export function InscriptionSubmissionsFiltersToolbar(props: Props) {
  return (
    <Suspense fallback={<ToolbarSkeleton />}>
      <InscriptionSubmissionsFiltersToolbarUi {...props} />
    </Suspense>
  );
}

function QueuePill({
  href,
  active,
  tone,
  children,
}: {
  href: string;
  active: boolean;
  tone?: "warning" | "info" | "success";
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2",
        active
          ? cn(
              "border-primary/50 bg-primary/12 text-foreground shadow-sm",
              tone === "warning" && "border-amber-500/45 bg-amber-500/12",
              tone === "info" && "border-sky-500/45 bg-sky-500/12",
              tone === "success" && "border-emerald-600/45 bg-emerald-600/12",
            )
          : cn(
              "border-border/80 bg-muted/25 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            ),
      )}
      aria-current={active ? "true" : undefined}
    >
      {children}
    </Link>
  );
}
