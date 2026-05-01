/**
 * Transition Lookup
 *
 * Functions for finding transitions between VTG categories
 * and looking up transition type definitions.
 */

import type {
	VTGTransition,
	TransitionType,
	TransitionMatrixEntry,
} from "../data/transitions.js";
import {
	VTG_TRANSITIONS,
	VTG_TRANSITION_MATRICES,
} from "../data/transitions.js";

export function getVTGTransition(id: string): VTGTransition | undefined {
	return VTG_TRANSITIONS.find((t) => t.id === id);
}

export function getTransitionBetween(
	fromCategoryId: string,
	toCategoryId: string,
): TransitionMatrixEntry | undefined {
	const matrix = VTG_TRANSITION_MATRICES.find(
		(m) => m.fromCategoryId === fromCategoryId,
	);
	if (!matrix) return undefined;
	return matrix.entries.find((e) => e.toCategoryId === toCategoryId);
}

export function getTransitionsFrom(
	categoryId: string,
	type?: TransitionType,
): TransitionMatrixEntry[] {
	const matrix = VTG_TRANSITION_MATRICES.find(
		(m) => m.fromCategoryId === categoryId,
	);
	if (!matrix) return [];
	return matrix.entries.filter((e) => !type || e.transitionType === type);
}
