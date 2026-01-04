/**
 * IPropClickHandler - Contract for handling prop clicks in beat editor
 *
 * Handles variant cycling when a prop is tapped.
 * Updates both the selection state (for visual feedback) and
 * the settings (to persist the new prop variant).
 */

import type { PropHand } from "../../state/selected-prop-state.svelte";

export interface IPropClickHandler {
	/**
	 * Handle a prop being clicked in the beat editor.
	 * Cycles to the next variant and updates selection state.
	 *
	 * @param beatIndex - The index of the beat containing the clicked prop
	 * @param hand - Which hand's prop was clicked ('blue' or 'red')
	 */
	handlePropClick(beatIndex: number, hand: PropHand): void;

	/**
	 * Check if the Buugeng family props require showing the chirality drawer.
	 * Call this after handlePropClick to determine if drawer should open.
	 *
	 * @param hand - Which hand's prop to check
	 * @returns true if the prop is a Buugeng family prop (has chirality option)
	 */
	isBuugengFamily(hand: PropHand): boolean;
}
