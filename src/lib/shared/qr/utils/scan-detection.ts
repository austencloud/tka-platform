/**
 * Deduplicates visits to the dedicated `/q/{code}` scan route.
 *
 * Browser navigation timing cannot tell a camera scan from a typed URL or a
 * clicked link. It only distinguishes a new navigation from reload and history
 * traversal. The route is therefore the attribution boundary; this helper only
 * answers whether the current route visit is the first eligible one in the tab.
 */

const SCAN_ROUTE_PREFIX = "/q/";
const SCAN_ROUTE_SESSION_PREFIX = "tka:scanned:";

export function isFirstScanRouteVisit(code: string): boolean {
  if (typeof window === "undefined") return false;
  if (!window.location.pathname.startsWith(SCAN_ROUTE_PREFIX)) return false;

  const navEntries = performance.getEntriesByType?.("navigation") ?? [];
  const nav = navEntries[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    // A scan-route reload or history traversal is still the same visit.
    if (nav.type !== "navigate") return false;
  }

  try {
    const key = `${SCAN_ROUTE_SESSION_PREFIX}${code}`;
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    // With storage disabled, treat the first navigation as an eligible visit.
  }

  return true;
}
