/**
 * Grid Transition Lookup
 *
 * Functions for finding transitions between grid positions or modes.
 */

import type { GridTransition, GridTransitionMethod } from "../data/transitions.js";
import { NINE_SQUARE_TRANSITIONS } from "../data/transitions.js";

/** Get a specific transition by ID */
export function getGridTransition(id: string): GridTransition | undefined {
	// TODO: Implement lookup once transition data is populated
	return NINE_SQUARE_TRANSITIONS.find((t) => t.id === id);
}

/** Find transitions from a given position, optionally filtered by method */
export function getTransitionsFrom(
	positionId: string,
	method?: GridTransitionMethod,
): GridTransition[] {
	// TODO: Implement filtering once transition data is populated
	return NINE_SQUARE_TRANSITIONS.filter(
		(t) =>
			t.fromId === positionId &&
			(!method || t.method === method),
	);
}
