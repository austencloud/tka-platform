import { createContainer } from "iti";
import { FirePointOverrideProvider } from "$lib/features/effects-lab/services/implementations/FirePointOverrideProvider";
import { LedPointOverrideProvider } from "$lib/features/effects-lab/services/implementations/LedPointOverrideProvider";
import { FireDefaultsLoader } from "$lib/shared/animation-engine/services/implementations/FireDefaultsLoader";
import { FireDefaultsPublisher } from "$lib/shared/animation-engine/services/implementations/FireDefaultsPublisher";
import { setFirePointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import { setLedPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropLedPoints";

/**
 * Effects Lab DI container.
 * Merges the former flame-lab and led-lab containers into one.
 *
 * Registration order matters: `fireDefaultsLoader` is declared first
 * because `firePointOverrideProvider` depends on it (ITI resolves by name).
 */
export const effectsLabContainer = createContainer()
	.add({
		fireDefaultsLoader: () => new FireDefaultsLoader(),
		fireDefaultsPublisher: () => new FireDefaultsPublisher(),
	})
	.add(({ fireDefaultsLoader }) => ({
		firePointOverrideProvider: () => {
			const provider = new FirePointOverrideProvider();

			// Hook into the domain-level fire point lookup so overrides
			// take effect automatically in FireTipTracker
			setFirePointOverrideProvider((propType) => provider.getOverride(propType));

			// Load admin-published defaults from Firestore; apply as lowest-priority fallback
			fireDefaultsLoader.load().then(() => {
				const firePoints = fireDefaultsLoader.getAllFirePoints();
				if (Object.keys(firePoints).length > 0) {
					provider.loadPublishedDefaults(firePoints);
				}
			});

			// Subscribe to real-time updates so published changes propagate immediately
			fireDefaultsLoader.subscribe(() => {
				const firePoints = fireDefaultsLoader.getAllFirePoints();
				if (Object.keys(firePoints).length > 0) {
					provider.loadPublishedDefaults(firePoints);
				}
			});

			return provider;
		},
	}))
	.add({
		ledPointOverrideProvider: () => {
			const provider = new LedPointOverrideProvider();

			// Hook into the domain-level LED point lookup so overrides
			// take effect automatically in LedTipTracker
			setLedPointOverrideProvider((propType) => provider.getOverride(propType));

			return provider;
		},
	});
