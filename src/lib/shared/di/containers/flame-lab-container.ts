import { createContainer } from "iti";
import { FirePointOverrideProvider } from "$lib/features/flame-lab/services/implementations/FirePointOverrideProvider";
import { FireDefaultsLoader } from "$lib/shared/animation-engine/services/implementations/FireDefaultsLoader";
import { FireDefaultsPublisher } from "$lib/shared/animation-engine/services/implementations/FireDefaultsPublisher";
import { FuelSourceLoader } from "$lib/shared/animation-engine/services/implementations/FuelSourceLoader";
import { FuelSourcePublisher } from "$lib/shared/animation-engine/services/implementations/FuelSourcePublisher";
import { setFirePointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropFirePoints";

/**
 * Flame Lab DI container.
 *
 * Registration order matters: `fireDefaultsLoader` is declared first
 * because `firePointOverrideProvider` depends on it (ITI resolves by name).
 */
export const flameLabContainer = createContainer()
	.add({
		fireDefaultsLoader: () => new FireDefaultsLoader(),
		fireDefaultsPublisher: () => new FireDefaultsPublisher(),
		fuelSourceLoader: () => new FuelSourceLoader(),
		fuelSourcePublisher: () => new FuelSourcePublisher(),
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
	}));
