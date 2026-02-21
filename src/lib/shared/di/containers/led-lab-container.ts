import { createContainer } from "iti";
import { LedPointOverrideProvider } from "$lib/features/led-lab/services/implementations/LedPointOverrideProvider";
import { setLedPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropLedPoints";

/**
 * LED Lab DI container.
 * Simpler than Flame Lab — no admin-published defaults (Firestore) for now.
 */
export const ledLabContainer = createContainer().add({
	ledPointOverrideProvider: () => {
		const provider = new LedPointOverrideProvider();

		// Hook into the domain-level LED point lookup so overrides
		// take effect automatically in LedTipTracker
		setLedPointOverrideProvider((propType) => provider.getOverride(propType));

		return provider;
	},
});
