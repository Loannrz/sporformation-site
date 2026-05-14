import type { AppLocale } from "@/i18n/routing";
import { CLOUD_STORAGE_QUOTA_BYTES } from "@/lib/constants";

const K = 1024;

/** Affiche une taille données en base binaire : Mo / Go (locale FR) ou MB / GB (EN). */
export function formatHumanBinaryBytes(bytes: number, locale: AppLocale): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const lf = locale === "fr" ? "fr-FR" : "en-US";
  const nf = new Intl.NumberFormat(lf, {
    maximumFractionDigits: bytes >= K ** 3 ? 2 : 1,
    minimumFractionDigits: 0,
  });
  const nbsp = "\u00A0";
  if (bytes >= K ** 3) {
    const label = locale === "fr" ? "Go" : "GB";
    return `${nf.format(bytes / K ** 3)}${nbsp}${label}`;
  }
  if (bytes >= K ** 2) {
    const label = locale === "fr" ? "Mo" : "MB";
    return `${nf.format(bytes / K ** 2)}${nbsp}${label}`;
  }
  if (bytes >= K) {
    const label = locale === "fr" ? "Ko" : "KB";
    return `${nf.format(bytes / K)}${nbsp}${label}`;
  }
  return locale === "fr" ? `${bytes}${nbsp}o` : `${bytes}${nbsp}B`;
}

/** Ex. FR : « 12,40 Go / 100 Go » · EN : « 12.4 GB / 100 GB ». */
export function formatCloudUsedVersusQuota(
  usedBytes: number | null,
  locale: AppLocale,
  quotaBytes: number = CLOUD_STORAGE_QUOTA_BYTES,
): string {
  const maxStr = formatHumanBinaryBytes(quotaBytes, locale);
  if (
    typeof usedBytes !== "number" ||
    !Number.isFinite(usedBytes) ||
    usedBytes < 0
  ) {
    return `— / ${maxStr}`;
  }
  const usedStr = formatHumanBinaryBytes(usedBytes, locale);
  return `${usedStr} / ${maxStr}`;
}
