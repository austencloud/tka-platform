/**
 * ICompositionLayoutCalculator - Determines card sizing in the adaptive hero grid
 *
 * Assigns hero/medium/compact sizes based on composition properties:
 * - Most recent composition gets "hero" (when enough columns)
 * - Favorited/pinned items get "medium"
 * - Everything else gets "compact"
 */

import type { CompositionBrowseItem } from "../../state/composition-browse-state.svelte";

export type CardSize = "hero" | "medium" | "compact";

export interface ICompositionLayoutCalculator {
	calculateCardSizes(
		compositions: CompositionBrowseItem[],
		columnCount: number
	): Map<string, CardSize>;
}
