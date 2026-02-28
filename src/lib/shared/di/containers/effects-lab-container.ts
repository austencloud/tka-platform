import { createContainer } from "iti";
import { EffectPointsPersister } from "$lib/features/effects-lab/services/implementations/EffectPointsPersister";
import { FirePointOverrideProvider } from "$lib/features/effects-lab/services/implementations/FirePointOverrideProvider";
import { LedPointOverrideProvider } from "$lib/features/effects-lab/services/implementations/LedPointOverrideProvider";
import { FireDefaultsLoader } from "$lib/shared/animation-engine/services/implementations/FireDefaultsLoader";
import { FireDefaultsPublisher } from "$lib/shared/animation-engine/services/implementations/FireDefaultsPublisher";
import { setFirePointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import { setLedPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropLedPoints";

/**
 * Effects Lab DI container.
 *
 * Registration order matters:
 * 1. `effectPointsPersister` — shared Firebase-backed position storage
 * 2. `fireDefaultsLoader` — admin-published fire defaults from Firestore
 * 3. `firePointOverrideProvider` / `ledPointOverrideProvider` — depend on persister
 */
export const effectsLabContainer = createContainer()
	.add({
		effectPointsPersister: () => {
			const persister = new EffectPointsPersister();
			persister.load();
			return persister;
		},
		fireDefaultsLoader: () => new FireDefaultsLoader(),
		fireDefaultsPublisher: () => new FireDefaultsPublisher(),
	})
	.add(({ effectPointsPersister, fireDefaultsLoader }) => ({
		firePointOverrideProvider: () => {
			const provider = new FirePointOverrideProvider(effectPointsPersister);

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
		ledPointOverrideProvider: () => {
			const provider = new LedPointOverrideProvider(effectPointsPersister);

			// Hook into the domain-level LED point lookup so overrides
			// take effect automatically in LedTipTracker
			setLedPointOverrideProvider((propType) => provider.getOverride(propType));

			return provider;
		},
	}));

export type EffectsLabContainer = typeof effectsLabContainer;
