/**
 * Couleurs d’accent déterministes par modèle (template_id UUID).
 * Valeurs littérales Tailwind conservées telles quelles pour le purge JIT.
 */

const PALETTE = [
  {
    stripe: "border-l-[5px] border-sky-500",
    gradient: "from-sky-500/14 via-card to-card",
    ring: "ring-sky-500/15",
    dot: "bg-sky-500",
  },
  {
    stripe: "border-l-[5px] border-violet-500",
    gradient: "from-violet-500/14 via-card to-card",
    ring: "ring-violet-500/15",
    dot: "bg-violet-500",
  },
  {
    stripe: "border-l-[5px] border-emerald-500",
    gradient: "from-emerald-500/14 via-card to-card",
    ring: "ring-emerald-500/15",
    dot: "bg-emerald-500",
  },
  {
    stripe: "border-l-[5px] border-amber-500",
    gradient: "from-amber-500/14 via-card to-card",
    ring: "ring-amber-500/15",
    dot: "bg-amber-500",
  },
  {
    stripe: "border-l-[5px] border-rose-500",
    gradient: "from-rose-500/14 via-card to-card",
    ring: "ring-rose-500/15",
    dot: "bg-rose-500",
  },
  {
    stripe: "border-l-[5px] border-cyan-500",
    gradient: "from-cyan-500/14 via-card to-card",
    ring: "ring-cyan-500/15",
    dot: "bg-cyan-500",
  },
  {
    stripe: "border-l-[5px] border-orange-500",
    gradient: "from-orange-500/14 via-card to-card",
    ring: "ring-orange-500/15",
    dot: "bg-orange-500",
  },
  {
    stripe: "border-l-[5px] border-teal-500",
    gradient: "from-teal-500/14 via-card to-card",
    ring: "ring-teal-500/15",
    dot: "bg-teal-500",
  },
] as const;

function hashStableKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = Math.imul(31, h) + key.charCodeAt(i)!;
    h |= 0;
  }
  return Math.abs(h);
}

export type InscriptionTemplateAccent = (typeof PALETTE)[number];

export function inscriptionTemplateAccent(templateIdOrSlug: string): InscriptionTemplateAccent {
  const k = templateIdOrSlug.trim() || "default";
  return PALETTE[hashStableKey(k) % PALETTE.length]!;
}

export function inscriptionTemplateCardToneClasses(templateKey: string): string {
  const a = inscriptionTemplateAccent(templateKey);
  return [
    "rounded-xl border border-border/70 bg-gradient-to-r shadow-sm",
    "ring-1 backdrop-blur-[0]",
    a.stripe,
    a.gradient,
    a.ring,
  ].join(" ");
}
