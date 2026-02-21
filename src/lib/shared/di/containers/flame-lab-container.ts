import { createContainer } from "iti";
import { FirePointOverrideProvider } from "$lib/features/flame-lab/services/implementations/FirePointOverrideProvider";
import { setFirePointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropFirePoints";

/**
 * Flame Lab DI container.
 * Registers the fire point override provider and hooks it into the
 * PropFirePoints lookup system via the callback pattern.
 */
export const flameLabContainer = createContainer().add({
	firePointOverrideProvider: () => {
		const provider = new FirePointOverrideProvider();
		// Hook into the domain-level fire point lookup so overrides
		// take effect automatically in FireTipTracker
		setFirePointOverrideProvider((propType) => provider.getOverride(propType));
		return provider;
	},
});
