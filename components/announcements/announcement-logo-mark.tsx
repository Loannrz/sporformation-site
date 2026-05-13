import {
  AnnouncementLogoId,
  normalizeAnnouncementLogoId,
} from "@/lib/announcement-logos";
import { announcementAccentIconClass } from "@/lib/announcement-accents";
import { cn } from "@/lib/utils";
import {
  Bell,
  Calendar,
  GraduationCap,
  Info,
  Megaphone,
  School,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const BY_ID: Record<AnnouncementLogoId, LucideIcon> = {
  megaphone: Megaphone,
  bell: Bell,
  calendar: Calendar,
  graduation: GraduationCap,
  school: School,
  info: Info,
  sparkle: Sparkles,
};

type Props = {
  logoKey: string;
  accentKey?: string;
  /** Taille décorative dans les cartes. */
  variant?: "md" | "lg";
  className?: string;
};

/** Icône du logo choisi lors de la publication (prédéfini). */
export function AnnouncementLogoMark({
  logoKey,
  accentKey,
  variant = "md",
  className,
}: Props) {
  const id = normalizeAnnouncementLogoId(logoKey);
  const Icon = BY_ID[id];
  const size =
    variant === "lg"
      ? "h-14 w-14 rounded-2xl border border-border bg-muted/60 p-2.5"
      : "h-11 w-11 rounded-xl border border-border bg-muted/50 p-2";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        accentKey
          ? announcementAccentIconClass(accentKey)
          : "text-primary",
        size,
        className,
      )}
      aria-hidden
    >
      <Icon className="h-full w-full" strokeWidth={1.75} />
    </div>
  );
}
