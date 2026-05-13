"use client";

import { useId } from "react";
import { twMerge } from "tailwind-merge";

type Props = {
  className?: string;
  compact?: boolean;
};

/** Logo wordmark : un id de dégradé unique par instance (évite les conflits si plusieurs SVG dans le DOM). */
export function SporformationLogo({ className, compact }: Props) {
  const rawId = useId().replace(/:/g, "");
  const gradId = `spo-grad-${rawId}`;

  return (
    <svg
      viewBox="0 0 220 40"
      role="img"
      aria-label="SPORFORMATION"
      preserveAspectRatio="xMinYMid meet"
      className={twMerge(
        "h-8 w-auto max-w-[200px] shrink-0",
        compact && "max-w-[140px]",
        className,
      )}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E63946" />
          <stop offset="100%" stopColor="#F4A261" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="28"
        fontSize="22"
        fontWeight="700"
        fill={`url(#${gradId})`}
        /* Pas de var() ici : certains navigateurs mobiles ne l’appliquent pas au <text> SVG. */
        fontFamily='ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      >
        SPORFORMATION
      </text>
    </svg>
  );
}
