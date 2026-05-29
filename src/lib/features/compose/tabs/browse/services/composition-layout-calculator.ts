/**
 * composition-layout-calculator
 *
 * Assigns card sizes for the adaptive hero grid layout.
 * The most recently updated composition gets hero sizing (when >= 3 columns),
 * favorited or pinned items get medium, everything else gets compact.
 */

import type { CompositionBrowseItem } from "../state/composition-browse-state.svelte";
import type { CardSize } from "./types";

export function calculateCardSizes(
  compositions: CompositionBrowseItem[],
  columnCount: number
): Map<string, CardSize> {
  const sizes = new Map<string, CardSize>();

  if (compositions.length === 0) return sizes;

  // Find the most recently updated composition
  const mostRecent = compositions.reduce((latest, current) =>
    current.updatedAt.getTime() > latest.updatedAt.getTime() ? current : latest
  );

  for (const composition of compositions) {
    if (composition.id === mostRecent.id && columnCount >= 3) {
      sizes.set(composition.id, "hero");
    } else if (composition.isFavorite || composition.isPinned) {
      sizes.set(composition.id, "medium");
    } else {
      sizes.set(composition.id, "compact");
    }
  }

  return sizes;
}
