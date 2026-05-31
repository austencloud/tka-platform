import { deriveSteps } from "$lib/shared/foundation/services/step-deriver";
import {
	extractBlueSoloProp,
	extractRedSoloProp,
	extractStepPairings,
} from "./sequence-decomposer";
import type { SequenceData } from "../domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { MotionColor, MotionType, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateHandpathDirection } from "$lib/shared/pictograph/arrow/positioning/calculation/services/handpath-direction-calculator";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";

// Legacy sequences saved before SoloPropStepData carried prefloatMotionType
// will arrive here with derived float motions whose prefloat fields are
// undefined, even though the original sequence.steps Firestore blob still
// holds them. This walks the derived steps and copies prefloat metadata back
// in, deriving prefloatRotationDirection from start/end + prefloatMotionType.
function backfillPrefloatFromLegacySteps(
	derived: StepData[],
	original: readonly StepData[]
): StepData[] {
	if (!original || original.length === 0) return derived;

	return derived.map((step, i) => {
		const orig = original[i];
		if (!orig?.motions) return step;

		const blue = step.motions?.blue;
		const red = step.motions?.red;
		const origBlue = orig.motions.blue;
		const origRed = orig.motions.red;

		const needsBlueBackfill =
			blue?.motionType === MotionType.FLOAT &&
			!blue.prefloatMotionType &&
			origBlue?.prefloatMotionType;
		const needsRedBackfill =
			red?.motionType === MotionType.FLOAT &&
			!red.prefloatMotionType &&
			origRed?.prefloatMotionType;

		if (!needsBlueBackfill && !needsRedBackfill) return step;

		const patched = { ...step, motions: { ...step.motions } };

		if (needsBlueBackfill && blue && origBlue) {
			const handpath = calculateHandpathDirection(
				blue.startLocation,
				blue.endLocation
			);
			const prefRot =
				handpath === "cw"
					? origBlue.prefloatMotionType === MotionType.PRO
						? RotationDirection.CLOCKWISE
						: RotationDirection.COUNTER_CLOCKWISE
					: handpath === "ccw"
						? origBlue.prefloatMotionType === MotionType.PRO
							? RotationDirection.COUNTER_CLOCKWISE
							: RotationDirection.CLOCKWISE
						: undefined;

			patched.motions.blue = {
				...blue,
				prefloatMotionType: origBlue.prefloatMotionType,
				...(prefRot && { prefloatRotationDirection: prefRot }),
			};
		}

		if (needsRedBackfill && red && origRed) {
			const handpath = calculateHandpathDirection(
				red.startLocation,
				red.endLocation
			);
			const prefRot =
				handpath === "cw"
					? origRed.prefloatMotionType === MotionType.PRO
						? RotationDirection.CLOCKWISE
						: RotationDirection.COUNTER_CLOCKWISE
					: handpath === "ccw"
						? origRed.prefloatMotionType === MotionType.PRO
							? RotationDirection.COUNTER_CLOCKWISE
							: RotationDirection.CLOCKWISE
						: undefined;

			patched.motions.red = {
				...red,
				prefloatMotionType: origRed.prefloatMotionType,
				...(prefRot && { prefloatRotationDirection: prefRot }),
			};
		}

		return patched;
	});
}

/**
 * Re-derives StepData from compositional fields (SoloPropData + StepPairingData).
 * Ensures derived fields are up-to-date with current domain logic.
 */
export function hydrate(sequence: SequenceData): SequenceData {
		// constructed creatorIntent from legacy fields
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

		if (
			sequence.blueSoloProp &&
			sequence.redSoloProp &&
			sequence.stepPairings &&
			sequence.stepPairings.length > 0
		) {
			const derived = deriveSteps(
				sequence.blueSoloProp,
				sequence.redSoloProp,
				sequence.stepPairings,
				{ bluePropType: PropType.STAFF, redPropType: PropType.STAFF, catDogMode: false }
			);

			const steps = backfillPrefloatFromLegacySteps(derived, sequence.steps);

			let startPosition = sequence.startPosition;
			if (!startPosition && steps.length > 0) {
				const first = steps[0];
				const blueMotion = first?.motions?.blue;
				const redMotion = first?.motions?.red;
				if (blueMotion || redMotion) {
					startPosition = {
						isStartPosition: true as const,
						id: `start-${sequence.id}`,
						letter: first.letter ?? null,
						endPosition: first.startPosition ?? first.endPosition ?? null,
						motions: {
							...(blueMotion && {
								[MotionColor.BLUE]: {
									...blueMotion,
									endLocation: blueMotion.startLocation,
									endOrientation: blueMotion.startOrientation,
									motionType: MotionType.STATIC,
									rotationDirection: RotationDirection.NO_ROTATION,
									turns: 0,
								},
							}),
							...(redMotion && {
								[MotionColor.RED]: {
									...redMotion,
									endLocation: redMotion.startLocation,
									endOrientation: redMotion.startOrientation,
									motionType: MotionType.STATIC,
									rotationDirection: RotationDirection.NO_ROTATION,
									turns: 0,
								},
							}),
						},
					};
				}
			}

			const hydrated = { ...sequence, steps, ...(startPosition && { startPosition }) };
			return hydrated.steps.length > 0
				? reversalDetector.processReversals(hydrated)
				: hydrated;
		}

		// Compositional fields missing - steps won't be derived.
		// This sequence either predates the migration or was saved by a code path
		// that doesn't call ensureComposition(). See the hydrate() docstring above.
		if (sequence.steps.length > 0 && !sequence.blueSoloProp) {
			console.warn(
				`[SequenceHydrator] Sequence "${sequence.word || sequence.id}" has steps but no compositional fields. ` +
				`Run \`node scripts/migrate-compositional.cjs\` to backfill, or check that ensureComposition() is called at save time.`
			);
		}

	return sequence.steps.length > 0
		? reversalDetector.processReversals(sequence)
		: sequence;
}

export function ensureComposition(sequence: SequenceData): SequenceData {
	// Nothing to decompose from an empty sequence.
	if (sequence.steps.length === 0) return sequence;

	const blueSoloProp = extractBlueSoloProp(sequence);
	const redSoloProp = extractRedSoloProp(sequence);
	const stepPairings = extractStepPairings(sequence);

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
