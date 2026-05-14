"use client";

import Image from "next/image";
import { twMerge } from "tailwind-merge";

type Props = {
  className?: string;
  compact?: boolean;
};

/**
 * Logo SPORFORMATION (PNG).
 * - La hauteur est imposée par `className` (ex: `h-8`, `h-10`) → la nav garde sa hauteur.
 * - La largeur s’adapte automatiquement au ratio natif (728×343 ≈ 2.12:1) via `w-auto`.
 * - `max-w-full` + `object-contain` permettent au logo de rétrécir si le conteneur est étroit
 *   (sidebar repliée, mobile) sans déborder ni écraser les autres éléments.
 */
export function SporformationLogo({ className, compact }: Props) {
  return (
    <Image
      src="/sporformation-logo.png"
      alt="SPORFORMATION"
      width={728}
      height={343}
      priority
      sizes="(max-width: 768px) 140px, 220px"
      className={twMerge(
        "h-8 w-auto max-w-full shrink-0 object-contain",
        compact && "max-w-[140px]",
        className,
      )}
    />
  );
}
