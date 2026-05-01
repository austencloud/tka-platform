/**
 * Transition Lookup
 *
 * Functions for retrieving CAP transition types.
 */

import type { CAPTransition } from "../data/transitions.js";
import { CAP_TRANSITIONS } from "../data/transitions.js";

export function getCAPTransition(id: string): CAPTransition | undefined {
	return CAP_TRANSITIONS.find((t) => t.id === id);
}

export function listCAPTransitions(): CAPTransition[] {
	return [...CAP_TRANSITIONS];
}
