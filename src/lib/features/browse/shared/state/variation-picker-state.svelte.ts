/**
 * Variation Picker State
 *
 * Tracks whether the variation picker drawer is open and what
 * variations to display. Used when a user taps a card that has
 * multiple sequences with the same word.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

let _isOpen = $state(false);
let _variations = $state<SequenceData[]>([]);

export function openVariationPicker(variations: SequenceData[]): void {
	_variations = variations;
	_isOpen = true;
}

export function closeVariationPicker(): void {
	_isOpen = false;
	_variations = [];
}

export function getVariationPickerState() {
	return {
		get isOpen() { return _isOpen; },
		get variations() { return _variations; },
	};
}
