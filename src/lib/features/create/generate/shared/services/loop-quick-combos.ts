/**
 * Ordering for the LOOP "Quick Combos" strip: pinned (starred) presets first,
 * then featured presets, de-duplicated. A starred non-featured preset is
 * surfaced; a starred featured preset appears once, in the starred position.
 */
import type { LOOPPreset } from "../domain/constants/loop-presets";

export function orderQuickCombos(
  presets: readonly LOOPPreset[],
  favoriteIds: readonly string[]
): LOOPPreset[] {
  const starred = presets.filter((p) => favoriteIds.includes(p.id));
  const featured = presets.filter((p) => p.featured);

  const seen = new Set<string>();
  const result: LOOPPreset[] = [];
  for (const p of [...starred, ...featured]) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      result.push(p);
    }
  }
  return result;
}
