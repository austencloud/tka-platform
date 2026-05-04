const arrowPositionCache = new Map<string, { x: number; y: number }>();

export function getArrowPositionCache(): Map<string, { x: number; y: number }> {
  return arrowPositionCache;
}

export function clearArrowPositionCache(): void {
  arrowPositionCache.clear();
}
