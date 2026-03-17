/**
 * Transition Lookup
 *
 * Functions for retrieving CAP transition types.
 */

import type { CAPTransition } from "../data/transitions.js";
import { CAP_TRANSITIONS } from "../data/transitions.js";

/** Get a specific transition by ID */
export function getCAPTransition(id: string): CAPTransition | undefined {
	return CAP_TRANSITIONS.find((t) => t.id === id);
}

/** List all CAP transitions */
export function listCAPTransitions(): CAPTransition[] {
	return [...CAP_TRANSITIONS];
}
