/**
 * PropClickHandler - Handles prop click interactions in beat editor
 *
 * When a prop is tapped:
 * 1. Updates selection state for visual feedback
 * 2. Cycles to next variant (Staff → Simple Staff → Big Staff → Staff V2 → ...)
 * 3. Updates settings with new prop type
 */

import { injectable } from "inversify";
import type { IPropClickHandler } from "../contracts/IPropClickHandler";
import {
	selectedPropState,
	type PropHand,
} from "../../state/selected-prop-state.svelte";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import {
	getNextVariation,
	hasVariations,
} from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// Buugeng family - props that have chirality (can be flipped)
const BUUGENG_FAMILY = new Set([
	PropType.BUUGENG,
	PropType.BIGBUUGENG,
	PropType.FRACTALGENG,
]);

@injectable()
export class PropClickHandler implements IPropClickHandler {
	handlePropClick(beatIndex: number, hand: PropHand): void {
		const settings = getSettings();

		// Get current prop type for this hand
		const currentPropType =
			hand === "blue"
				? (settings.bluePropType ?? PropType.STAFF)
				: (settings.redPropType ?? PropType.STAFF);

		// Update selection state for visual feedback
		selectedPropState.selectProp(beatIndex, hand);

		// Only cycle if this prop type has variants
		if (!hasVariations(currentPropType)) {
			return;
		}

		// Get next variant in the cycle
		const nextVariant = getNextVariation(currentPropType);

		// Update settings with new prop type
		if (hand === "blue") {
			settings.bluePropType = nextVariant;
		} else {
			settings.redPropType = nextVariant;
		}
	}

	isBuugengFamily(hand: PropHand): boolean {
		const settings = getSettings();
		const propType =
			hand === "blue"
				? (settings.bluePropType ?? PropType.STAFF)
				: (settings.redPropType ?? PropType.STAFF);

		return BUUGENG_FAMILY.has(propType);
	}
}
