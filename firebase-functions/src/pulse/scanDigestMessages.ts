/**
 * Pure message builders for the QR-scan digest notification.
 *
 * Kept dependency-free so they unit-test without Firebase. A burst of scans
 * coalesces into a single per-admin notification doc (see notifyAdminsScanDigest):
 * the first scan reads with full detail, and once more than one scan lands in
 * the window the message escalates to the count/cities digest.
 */

export interface SingleScanInput {
  /** Already run through simplifyRepeatedWord. */
  label: string;
  /** Display name of a signed-in, non-admin scanner; null when anonymous. */
  scannerName: string | null;
  city: string | null;
  country: string | null;
}

/** " in Portland, OR" — or "" when no location is known. */
export function locationSuffix(
  city: string | null,
  country: string | null
): string {
  const where = [city, country]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(", ");
  return where ? ` in ${where}` : "";
}

/** First scan in a window — full detail, attributed when signed in. */
export function singleScanMessage(input: SingleScanInput): string {
  const where = locationSuffix(input.city, input.country);
  return input.scannerName
    ? `${input.scannerName} scanned "${input.label}"${where}`
    : `"${input.label}" scanned${where}`;
}

/**
 * Burst digest — "9 scans · 3 cities · last 10 min". The cities clause is
 * dropped when no located scan has been seen yet.
 */
export function digestMessage(
  scanCount: number,
  cityCount: number,
  windowMinutes: number
): string {
  const parts = [`${scanCount} scans`];
  if (cityCount > 0) {
    parts.push(cityCount === 1 ? "1 city" : `${cityCount} cities`);
  }
  parts.push(`last ${windowMinutes} min`);
  return parts.join(" · ");
}
