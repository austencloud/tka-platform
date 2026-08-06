import type { NavigationVisit } from "./navigation-visit";

const FREQUENT_VISIT_FLOOR = 3;
const FREQUENCY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

export function selectRecentDestinationIds(
  visits: readonly NavigationVisit[],
  availableDestinationIds: ReadonlySet<string>,
  currentDestinationId: string | undefined,
  limit = 5
): string[] {
  return [...visits]
    .filter(
      ({ destinationId }) =>
        destinationId !== currentDestinationId &&
        availableDestinationIds.has(destinationId)
    )
    .sort((left, right) => right.lastVisitedAt - left.lastVisitedAt)
    .slice(0, limit)
    .map(({ destinationId }) => destinationId);
}

export function selectOftenUsedDestinationIds(
  visits: readonly NavigationVisit[],
  availableDestinationIds: ReadonlySet<string>,
  excludedDestinationIds: ReadonlySet<string>,
  now = Date.now(),
  limit = 3
): string[] {
  return [...visits]
    .filter(
      ({ destinationId, visitCount }) =>
        visitCount >= FREQUENT_VISIT_FLOOR &&
        availableDestinationIds.has(destinationId) &&
        !excludedDestinationIds.has(destinationId)
    )
    .map((visit) => ({
      ...visit,
      score:
        Math.log2(visit.visitCount + 1) *
        Math.pow(
          0.5,
          Math.max(0, now - visit.lastVisitedAt) / FREQUENCY_HALF_LIFE_MS
        ),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || right.lastVisitedAt - left.lastVisitedAt
    )
    .slice(0, limit)
    .map(({ destinationId }) => destinationId);
}
