const positionCache = new Map<string, { x: number; y: number }>();

export function getPropPositionCache(): Map<string, { x: number; y: number }> {
  return positionCache;
}

export function clearPropPositionCache(): void {
  positionCache.clear();
}
