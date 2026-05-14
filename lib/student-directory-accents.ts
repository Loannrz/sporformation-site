/** Décoratif : palettes pour cartes élève (vues métier / classe), pas administration. */

export type StudentDirectoryAccent = {
  shell: string;
  avatar: string;
};

export const STUDENT_DIRECTORY_ACCENTS: readonly StudentDirectoryAccent[] = [
  {
    shell:
      "border-l-[3px] border-l-primary/55 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-sm dark:from-primary/[0.12]",
    avatar:
      "bg-gradient-to-br from-primary/40 to-primary/15 text-primary ring-1 ring-primary/25 dark:from-primary/35 dark:to-primary/10",
  },
  {
    shell:
      "border-l-[3px] border-l-accent/55 bg-gradient-to-br from-accent/[0.08] via-card to-card shadow-sm dark:from-accent/[0.11]",
    avatar:
      "bg-gradient-to-br from-accent/40 to-accent/15 text-accent ring-1 ring-accent/25 dark:from-accent/35 dark:to-accent/10",
  },
  {
    shell:
      "border-l-[3px] border-l-emerald-500/45 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card shadow-sm dark:from-emerald-500/[0.1]",
    avatar:
      "bg-gradient-to-br from-emerald-500/35 to-emerald-600/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300",
  },
  {
    shell:
      "border-l-[3px] border-l-violet-500/45 bg-gradient-to-br from-violet-500/[0.07] via-card to-card shadow-sm dark:from-violet-500/[0.1]",
    avatar:
      "bg-gradient-to-br from-violet-500/35 to-violet-600/15 text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-300",
  },
  {
    shell:
      "border-l-[3px] border-l-amber-500/45 bg-gradient-to-br from-amber-500/[0.07] via-card to-card shadow-sm dark:from-amber-500/[0.1]",
    avatar:
      "bg-gradient-to-br from-amber-500/35 to-orange-500/15 text-amber-900 ring-1 ring-amber-500/25 dark:text-amber-200",
  },
];

export function studentDirectoryAccentIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h + seed.charCodeAt(i) * (i + 1)) % 2147483647;
  }
  return h % STUDENT_DIRECTORY_ACCENTS.length;
}

export function studentInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  const pair = `${a}${b}`.toUpperCase();
  return pair || "?";
}
