import { CLOUD_STORAGE_QUOTA_BYTES } from "@/lib/constants";

/** Ratio 0 à +∞ selon occupation du quota (`used / quota`). */
export function cloudStorageQuotaUsageRatio(
  usedBytes: number | null,
  quotaBytes: number = CLOUD_STORAGE_QUOTA_BYTES,
): number {
  const q = Math.max(1, quotaBytes);
  if (
    typeof usedBytes !== "number" ||
    !Number.isFinite(usedBytes) ||
    usedBytes <= 0
  ) {
    return 0;
  }
  return usedBytes / q;
}

/**
 * Bordure carte Cloud direction : vert si usage sous 75 %, orange à partir de 75 %,
 * rouge à partir de 90 % du quota (`CLOUD_STORAGE_QUOTA_BYTES`).
 */
export function cloudStorageQuotaBorderClassName(
  usageRatio: number,
): string {
  const r = Math.max(0, usageRatio);
  if (r >= 0.9) {
    return "border-2 border-red-500/70 shadow-sm dark:border-red-400/60";
  }
  if (r >= 0.75) {
    return "border-2 border-amber-500/70 shadow-sm dark:border-amber-400/55";
  }
  return "border-2 border-emerald-500/65 shadow-sm dark:border-emerald-400/55";
}
