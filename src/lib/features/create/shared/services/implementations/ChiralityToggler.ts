/**
 * ChiralityToggler - Toggles Buugeng chirality in settings
 *
 * Buugeng props are asymmetric and can be displayed in two
 * mirror orientations. This service toggles the flip state
 * stored in settings (blueBuugengFlipped / redBuugengFlipped).
 */

import { injectable } from "inversify";
import type { IChiralityToggler } from "../contracts/IChiralityToggler";
import type { PropHand } from "../../state/selected-prop-state.svelte";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";

@injectable()
export class ChiralityToggler implements IChiralityToggler {
	toggleChirality(hand: PropHand): void {
		const settings = getSettings();

		if (hand === "blue") {
			settings.blueBuugengFlipped = !(settings.blueBuugengFlipped ?? false);
		} else {
			settings.redBuugengFlipped = !(settings.redBuugengFlipped ?? false);
		}
	}

	isFlipped(hand: PropHand): boolean {
		const settings = getSettings();

		if (hand === "blue") {
			return settings.blueBuugengFlipped ?? false;
		} else {
			return settings.redBuugengFlipped ?? false;
		}
	}
}
