export function resolveAvatarPreviewPerformer<T>(
  performers: readonly T[],
  selectedIndex: number | null
): T | null {
  if (selectedIndex === null) return performers[0] ?? null;
  return performers[selectedIndex] ?? performers[0] ?? null;
}
