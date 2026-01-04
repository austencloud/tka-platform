/**
 * IChiralityToggler - Contract for toggling Buugeng chirality
 *
 * Buugeng props are asymmetric and can be displayed in two
 * mirror orientations (chirality). This service handles flipping
 * the chirality setting for each hand.
 */

import type { PropHand } from "../../state/selected-prop-state.svelte";

export interface IChiralityToggler {
	/**
	 * Toggle the chirality (flip) for the specified hand's Buugeng prop.
	 * Only affects Buugeng family props (Buugeng, Big Buugeng, Fractalgeng).
	 *
	 * @param hand - Which hand's chirality to toggle ('blue' or 'red')
	 */
	toggleChirality(hand: PropHand): void;

	/**
	 * Get the current chirality state for a hand.
	 *
	 * @param hand - Which hand to check
	 * @returns true if the prop is currently flipped
	 */
	isFlipped(hand: PropHand): boolean;
}
