import type { ISequenceHydrator } from "../contracts/ISequenceHydrator";
import type { IStepDeriver } from "../contracts/IStepDeriver";
import type { ISequenceDecomposer } from "../contracts/ISequenceDecomposer";
import type { SequenceData } from "../../domain/models/SequenceData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export class SequenceHydrator implements ISequenceHydrator {
	constructor(
		private readonly stepDeriver: IStepDeriver,
		private readonly sequenceDecomposer: ISequenceDecomposer
	) {}

	hydrate(sequence: SequenceData): SequenceData {
		// Read-time migration: construct creatorIntent from legacy fields
		if (!sequence.creatorIntent) {
			const legacyPropConfig = sequence.intendedProp;
			const legacyEffort = sequence.effortTimeline;

			if (legacyPropConfig || legacyEffort) {
				sequence = {
					...sequence,
					creatorIntent: {
						propConfig: legacyPropConfig
							? {
									bluePropType: legacyPropConfig.bluePropType,
									redPropType: legacyPropConfig.redPropType,
									catDogMode: legacyPropConfig.catDogMode,
								}
							: { bluePropType: PropType.STAFF, redPropType: PropType.STAFF, catDogMode: false },
						...(legacyEffort && { effortTimeline: legacyEffort }),
					},
				};
			}
		}

		// If compositional fields are present, derive steps from them.
		// This makes compositional fields the authoritative source of truth —
		// all 173+ consumer files that read .steps get data derived from the
		// compositional model without any code changes.
		if (
			sequence.blueSoloProp &&
			sequence.redSoloProp &&
			sequence.stepPairings &&
			sequence.stepPairings.length > 0
		) {
			const steps = this.stepDeriver.deriveSteps(
				sequence.blueSoloProp,
				sequence.redSoloProp,
				sequence.stepPairings
			);
			return { ...sequence, steps };
		}
		return sequence;
	}

	ensureComposition(sequence: SequenceData): SequenceData {
		// Nothing to decompose from an empty sequence.
		if (sequence.steps.length === 0) return sequence;

		const blueSoloProp =
			this.sequenceDecomposer.extractBlueSoloProp(sequence);
		const redSoloProp =
			this.sequenceDecomposer.extractRedSoloProp(sequence);
		const stepPairings =
			this.sequenceDecomposer.extractStepPairings(sequence);

		return {
			...sequence,
			blueSoloProp,
			redSoloProp,
			stepPairings,
			bluePathHash: blueSoloProp.handPath.contentHash,
			redPathHash: redSoloProp.handPath.contentHash,
			blueSoloHash: blueSoloProp.contentHash,
			redSoloHash: redSoloProp.contentHash,
		};
	}
}
