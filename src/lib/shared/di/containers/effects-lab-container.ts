import { createContainer } from "iti";
import { EffectPointsPersister } from "$lib/features/effects-lab/services/implementations/EffectPointsPersister";
import { TipPointOverrideProvider } from "$lib/features/effects-lab/services/implementations/TipPointOverrideProvider";
import { FireDefaultsLoader } from "$lib/shared/animation-engine/services/implementations/FireDefaultsLoader";
import { FireDefaultsPublisher } from "$lib/shared/animation-engine/services/implementations/FireDefaultsPublisher";
import { setTipPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/PropTipPoints";
import { setTrailPointOverrideProvider } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";

/**
 * Effects Lab DI container.
 *
 * Registration order matters:
 * 1. `effectPointsPersister` — shared Firebase-backed position storage
 * 2. `fireDefaultsLoader` — admin-published defaults from Firestore
 * 3. `tipPointOverrideProvider` — depends on persister, single unified provider
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
		tipPointOverrideProvider: () => {
			const provider = new TipPointOverrideProvider(effectPointsPersister);

			// Hook into the domain-level tip point lookup so overrides
			// take effect automatically in all tip trackers
			setTipPointOverrideProvider((propType) => provider.getOverride(propType));

			// Hook trail point assignments into the domain-level lookup
			// so PropPositionCalculator can resolve trail configs without
			// depending on the effects-lab feature layer
			setTrailPointOverrideProvider((propType) => provider.getTrailAssignment(propType));

			// Load admin-published defaults from Firestore; strip flameScale
			// from legacy fire point data to produce position-only tip configs
			fireDefaultsLoader.load().then(() => {
				const firePoints = fireDefaultsLoader.getAllFirePoints();
				if (Object.keys(firePoints).length > 0) {
					const tipDefaults: Record<string, { points: { dx: number; dy: number }[] }> = {};
					for (const [key, config] of Object.entries(firePoints)) {
						tipDefaults[key] = {
							points: config.points.map((p) => ({ dx: p.dx, dy: p.dy })),
						};
					}
					provider.loadPublishedDefaults(tipDefaults);
				}
			});

			// Subscribe to real-time updates
			fireDefaultsLoader.subscribe(() => {
				const firePoints = fireDefaultsLoader.getAllFirePoints();
				if (Object.keys(firePoints).length > 0) {
					const tipDefaults: Record<string, { points: { dx: number; dy: number }[] }> = {};
					for (const [key, config] of Object.entries(firePoints)) {
						tipDefaults[key] = {
							points: config.points.map((p) => ({ dx: p.dx, dy: p.dy })),
						};
					}
					provider.loadPublishedDefaults(tipDefaults);
				}
			});

			return provider;
		},
	}));

export type EffectsLabContainer = typeof effectsLabContainer;
