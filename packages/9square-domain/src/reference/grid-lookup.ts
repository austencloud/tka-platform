/**
 * Grid Position Lookup
 *
 * Functions for finding and listing positions in the 9-Square grid.
 */

import type { GridPosition } from "../data/grid.js";
import { NINE_SQUARE_POSITIONS } from "../data/grid.js";

export function getGridPosition(id: string): GridPosition | undefined {
	// TODO: Implement lookup once grid data is populated
	return NINE_SQUARE_POSITIONS.find((p) => p.id === id);
}

export function listGridPositions(mode?: "diamond" | "box"): GridPosition[] {
	// TODO: Implement filtering once grid data is populated
	if (!mode) return NINE_SQUARE_POSITIONS;
	return NINE_SQUARE_POSITIONS.filter(
		(p) => p.mode === mode || p.mode === "both",
	);
}
