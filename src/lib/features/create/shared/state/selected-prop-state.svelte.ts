/**
 * Selected Prop State
 *
 * Manages the currently selected prop for variant cycling and chirality toggling
 * in the beat editor. Tracks which beat and which hand (blue/red) was tapped.
 */

export type PropHand = 'blue' | 'red';

interface SelectedProp {
	beatIndex: number;
	hand: PropHand;
}

// Use plain JavaScript object instead of $state at module level
// to avoid issues with DevTools during refresh (same pattern as selected-arrow-state)
let _selectedProp: SelectedProp | null = null;

export const selectedPropState = {
	get selectedProp() {
		return _selectedProp;
	},

	get beatIndex(): number | null {
		return _selectedProp?.beatIndex ?? null;
	},

	get hand(): PropHand | null {
		return _selectedProp?.hand ?? null;
	},

	selectProp(beatIndex: number, hand: PropHand) {
		_selectedProp = { beatIndex, hand };
	},

	clear() {
		_selectedProp = null;
	},

	clearIfBeatIndex(index: number) {
		if (_selectedProp?.beatIndex === index) {
			_selectedProp = null;
		}
	},

	isSelected(beatIndex: number, hand: PropHand): boolean {
		if (!_selectedProp) return false;
		return _selectedProp.beatIndex === beatIndex && _selectedProp.hand === hand;
	}
};
