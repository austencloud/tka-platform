import { deriveSteps } from "$lib/shared/foundation/services/step-deriver";
import {
	extractBlueSoloProp,
	extractRedSoloProp,
	extractStepPairings,
} from "./sequence-decomposer";
import type { SequenceData } from "../domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { MotionType, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { calculateHandpathDirection } from "$lib/shared/pictograph/arrow/positioning/calculation/services/handpath-direction-calculator";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
import { ensureStepPlacement } from "$lib/shared/pictograph/shared/services/motion-placement";

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
 * Reconstruct the start-position pictograph from a sequence's first step.
 * Delegates to the canonical StartPositionDeriver, which computes the actual
 * start POSITION (alpha/beta/gamma) from the first step's blue+red start
 * locations and places both props STATIC there. Shared by hydrate() (runtime)
 * and ensureComposition() (persist time) so a sequence always carries a
 * renderable start cell — labelled with the position glyph, NOT the first
 * step's letter (the bug that showed U/B/V… in the start cell). Returns
 * undefined when the first step lacks the blue/red motions to derive from.
 */
function deriveStartPositionFromSteps(
	steps: readonly StepData[]
): SequenceData["startPosition"] | undefined {
	const first = steps[0];
	// Invisible placeholder = hand not really there (both-required Step shape);
	// deriving a start cell from a placeholder's default location would lie.
	if (!isVisibleMotion(first?.motions?.blue) || !isVisibleMotion(first?.motions?.red)) return undefined;
	try {
    return startPositionDeriver.deriveFromFirstStep(first) as SequenceData["startPosition"];
	} catch {
		return undefined;
	}
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
				// No recorded prop intent means propConfig stays absent. A staff/staff
				// default here would persist as an indistinguishable fake recording.
				sequence = {
					...sequence,
					creatorIntent: {
						...(legacyPropConfig && {
							propConfig: {
								bluePropType: legacyPropConfig.bluePropType,
								redPropType: legacyPropConfig.redPropType,
								catDogMode: legacyPropConfig.catDogMode,
							},
						}),
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

			// A stored startPosition is kept as-is (the `??` only derives when it is
			// absent), so an older document's start cell arrives with motions that
			// predate arrow/propPlacementData — and the renderer drops props and
			// arrows SILENTLY for exactly that shape. Backfill before returning.
			const storedStart = sequence.startPosition ?? deriveStartPositionFromSteps(steps);
			const startPosition = storedStart ? ensureStepPlacement(storedStart) : undefined;

			const hydrated = { ...sequence, steps, ...(startPosition && { startPosition }) };
			return hydrated.steps.length > 0
				? reversalDetector.processReversals(hydrated)
				: hydrated;
		}

		// Compositional fields missing - steps won't be derived here.
		// The sequence predates ensureComposition() or was saved by a path that
		// skips it. No action needed: ensureComposition() runs on every save
		// (library-repository) and on publish (library-batch-operations), so the
		// doc self-heals the next time it's touched. Read-time consumers that need
		// the fields immediately derive them on the fly (see hand-path explorer).
		// There is no bulk migration script - that path is archived in favour of
		// lazy heal-on-save (content-hash V2).
		if (sequence.steps.length > 0 && !sequence.blueSoloProp) {
			console.debug(
				`[SequenceHydrator] Sequence "${sequence.word || sequence.id}" has steps but no ` +
				`compositional fields; will heal on next save/publish. Derive read-time if needed.`
			);
		}

	// This branch returns STORED steps untouched (they are only rebuilt when the
	// compositional fields are present, above), so they need the same guarantee
	// the derived ones get for free from createMotionData.
	const withPlacement = {
		...sequence,
		steps: sequence.steps.map(ensureStepPlacement),
		...(sequence.startPosition && {
			startPosition: ensureStepPlacement(sequence.startPosition),
		}),
	};

	return withPlacement.steps.length > 0
		? reversalDetector.processReversals(withPlacement)
		: withPlacement;
}

export function ensureComposition(sequence: SequenceData): SequenceData {
	// Nothing to decompose from an empty sequence.
	if (sequence.steps.length === 0) return sequence;

	const blueSoloProp = extractBlueSoloProp(sequence);
	const redSoloProp = extractRedSoloProp(sequence);
	const stepPairings = extractStepPairings(sequence);

	// Persist a start position alongside the compositional fields. It is NOT
	// derivable from blue/redSoloProp + stepPairings alone, so without this the
	// saved doc (and its public mirror) renders an empty start cell — exactly the
	// bug the 2026-06 backfill repaired. Deriving here keeps every save/publish
	// self-sufficient instead of relying on read-time hydrate().
	// Persist-time twin of the read-time backfill above: a doc saved from an
	// already-lean startPosition would otherwise write the propless shape back.
	const derivedStart =
		sequence.startPosition ?? deriveStartPositionFromSteps(sequence.steps);
	const startPosition = derivedStart ? ensureStepPlacement(derivedStart) : undefined;

	return {
		...sequence,
		blueSoloProp,
		redSoloProp,
		stepPairings,
		bluePathHash: blueSoloProp.handPath.contentHash,
		redPathHash: redSoloProp.handPath.contentHash,
		blueSoloHash: blueSoloProp.contentHash,
		redSoloHash: redSoloProp.contentHash,
		...(startPosition && { startPosition }),
	};
}
