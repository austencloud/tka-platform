import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Toggle one allowed position while keeping the picker usable. The final
 * enabled position stays enabled because generation always needs somewhere to
 * start or end.
 */
export function toggleBlockedPosition(
  allPositions: readonly GridPosition[],
  blockedPositions: GridPosition[],
  position: GridPosition
): GridPosition[] {
  const blocked = new Set(blockedPositions);
  if (blocked.has(position)) {
    return blockedPositions.filter((candidate) => candidate !== position);
  }

  const enabledCount = allPositions.filter(
    (candidate) => !blocked.has(candidate)
  ).length;
  if (enabledCount <= 1) return blockedPositions;

  return [...blockedPositions, position];
}

/** Keep one chosen position enabled and block every other visible position. */
export function blockAllExcept(
  allPositions: readonly GridPosition[],
  position: GridPosition
): GridPosition[] {
  return allPositions.filter((candidate) => candidate !== position);
}

/** Compare two blocklists as sets so preset order never affects active styling. */
export function hasSameBlockedPositions(
  first: readonly GridPosition[],
  second: readonly GridPosition[]
): boolean {
  if (first.length !== second.length) return false;
  const secondSet = new Set(second);
  return first.every((position) => secondSet.has(position));
}
