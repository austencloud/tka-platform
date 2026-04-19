/**
 * Scan-authenticity detection.
 *
 * Distinguishes a real-world QR scan (someone pointing a camera at a card,
 * or clicking a shared link) from a page refresh or back/forward navigation.
 * Used by every resolver path to decide whether to bump `scanCount` and
 * write a scanEvent. Without this, F5 inflates the scan count and the
 * admin dashboard lies about reach.
 *
 * A load is a real scan if BOTH are true:
 *   1. `performance` says the navigation type is `navigate` (not `reload`
 *      or `back_forward`).
 *   2. We haven't already counted this code in the current session
 *      (sessionStorage lives for the tab's lifetime).
 */

const SCAN_SESSION_PREFIX = "tka:scanned:";

export function isGenuineScan(code: string): boolean {
  if (typeof window === "undefined") return false;

  const navEntries = performance.getEntriesByType?.("navigation") ?? [];
  const nav = navEntries[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    // navigate → first load, or a fresh URL entry. That's the scan case.
    // reload / back_forward / prerender → not a scan.
    if (nav.type !== "navigate") return false;
  }

  try {
    const key = `${SCAN_SESSION_PREFIX}${code}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode / storage disabled — default to counting the scan.
  }

  return true;
}
