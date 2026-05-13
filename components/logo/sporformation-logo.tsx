import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  compact?: boolean;
};

export function SporformationLogo({ className, compact }: Props) {
  return (
    <svg
      viewBox="0 0 220 40"
      role="img"
      aria-label="SPORFORMATION"
      className={cn("w-[200px] max-w-full", compact && "w-[140px]", className)}
    >
      <defs>
        <linearGradient id="spo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E63946" />
          <stop offset="100%" stopColor="#F4A261" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="28"
        fontSize="22"
        fontWeight="700"
        fill="url(#spo-grad)"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
      >
        SPORFORMATION
      </text>
    </svg>
  );
}
