/**
 * Variant generator — every re-orientation of a card the combination search is
 * allowed to try.
 *
 * Two independent axes:
 *
 *  1. **Spatial / colour** — rotation (even 45° steps only, so grid mode is
 *     preserved), vertical mirror, blue<->red swap. These reuse the create
 *     module's transform pipeline verbatim (`rotateSequence`, `mirrorSequence`,
 *     `swapColors`); nothing is re-derived here.
 *  2. **The rotation-faithful twin** — see {@link buildRotationFaithfulTwin}.
 *
 * Full liberties emit 4 x 2 x 2 x 2 = 32 sources, twin applied LAST so it
 * operates on the already-transformed material.
 *
 * Letter hygiene: none of the create-module transforms re-derive letters (both
 * `mirrorBeat` and `colorSwapBeat` map positions through a lookup table and
 * leave `letter` alone; `rotateBeat` derives positions but not letters). Mirror
 * and colour swap CAN change a step's letter, so every variant runs through
 * `deriveSequenceLetters` and gets its `word` recomputed from the result.
 */

import {
  deriveSequenceLetters,
  mirrorSequence,
  rotateSequence,
  swapColors,
} from "$lib/shared/create/services/sequence-transformer";
import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  updateSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { deriveWordFromBeats } from "$lib/shared/foundation/services/word-deriver";
import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-location-calculator";
import type { HandPath } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  MotionColor,
  type MotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  deriveMotionType,
  getHandpathDirection,
} from "$lib/shared/render/core/calculations/orientation";

import type { VariantDescriptor, WalkSource } from "../domain/types";

/** Even 45°-steps only — odd amounts toggle diamond<->box. */
const ROTATIONS: readonly (0 | 2 | 4 | 6)[] = [0, 2, 4, 6];

export interface VariantLiberties {
  readonly allowMirror: boolean;
  readonly allowRotation: boolean;
  readonly allowColorSwap: boolean;
  readonly exploreRotationFaithful: boolean;
}

/** "id", "r2", "mirror+swap", "r6+mirror+swap+twin" — injective, deterministic. */
function describeVariant(variant: VariantDescriptor): string {
  const parts = [
    variant.rotation ? `r${variant.rotation}` : "",
    variant.mirrored ? "mirror" : "",
    variant.colorSwapped ? "swap" : "",
    variant.rotationFaithful ? "twin" : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("+") : "id";
}

// ---------------------------------------------------------------------------
// The rotation-faithful twin
// ---------------------------------------------------------------------------

/**
 * Recompute the arrow locations of a step through the canonical calculator.
 *
 * A DASH's arrow location depends on the OTHER hand, so this cannot be done
 * per-motion — the whole step goes in. Same seam the fixtures use; it is called
 * here directly rather than through `assemble-lab`'s `withCalculatedArrowLocations`
 * wrapper because `shared/` must not import from `features/`.
 */
function withArrowLocations(step: StepData): StepData {
  return {
    ...step,
    motions: {
      blue: {
        ...step.motions.blue,
        arrowLocation: arrowLocationCalculator.calculateLocation(
          step.motions.blue,
          step
        ),
      },
      red: {
        ...step.motions.red,
        arrowLocation: arrowLocationCalculator.calculateLocation(
          step.motions.red,
          step
        ),
      },
    },
  };
}

/**
 * One motion, traversed backwards with its prop rotation untouched.
 *
 * `motionType` is NOT carried over — it is a FUNCTION of (hand path, rotation
 * direction, turns), which is exactly what `deriveMotionType` computes. Holding
 * the rotation while reversing the path is what flips PRO<->ANTI. DASH stays
 * DASH and STATIC stays STATIC by the same function (their hand paths have no
 * orbital direction, so rotation direction never enters the classification).
 *
 * Orientations are swapped as a provisional value only: the true chain is
 * re-derived downstream (`recalculateAllOrientations` in the splice-builder),
 * because the entry orientation of a spliced block depends on what precedes it.
 */
function reverseMotion(motion: MotionData): MotionData {
  const startLocation = motion.endLocation;
  const endLocation = motion.startLocation;

  const motionType = deriveMotionType(
    startLocation,
    endLocation,
    motion.rotationDirection,
    motion.turns
  ) as MotionType;

  return createMotionData({
    ...motion,
    motionType,
    startLocation,
    endLocation,
    startOrientation: motion.endOrientation,
    endOrientation: motion.startOrientation,
    // Both are cached derivations of the hand path; recompute rather than
    // carry a value that now describes the opposite direction.
    ...(motion.handPath != null && {
      handPath: getHandpathDirection(startLocation, endLocation) as HandPath,
    }),
    ...(motion.prefloatMotionType !== undefined &&
      motion.prefloatRotationDirection !== undefined && {
        prefloatMotionType: deriveMotionType(
          startLocation,
          endLocation,
          motion.prefloatRotationDirection,
          0
        ) as MotionType,
      }),
  });
}

/** One step, traversed backwards. Letter is blanked for re-derivation. */
function reverseStep(step: StepData, stepNumber: number): StepData {
  return withArrowLocations(
    createStepData({
      ...step,
      id: `${step.id}~twin`,
      stepNumber,
      startPosition: step.endPosition,
      endPosition: step.startPosition,
      // A carried-over letter would be a lie (a G on an anti step). Null here
      // means the re-derivation below genuinely failed to find a dataframe row.
      letter: null,
      motions: {
        [MotionColor.BLUE]: reverseMotion(step.motions.blue),
        [MotionColor.RED]: reverseMotion(step.motions.red),
      },
      // Reversal flags describe adjacency in the OLD ordering.
      blueReversal: false,
      redReversal: false,
    })
  );
}

/**
 * The rotation-faithful twin: the same card traversed backwards while every
 * prop keeps rotating the way it already was.
 *
 * This models Austen's FLGGFLHH card — the prop rotation flows continuously
 * counter-clockwise while the hand path reverses, and the G-run reads as an
 * H-run as a consequence. Concretely: reverse the step order, swap each step's
 * start/end position, swap each motion's start/end location and orientation,
 * KEEP each motion's `rotationDirection`, then re-derive `motionType` and the
 * letters.
 *
 * Proven against the fixtures: `buildRotationFaithfulTwin(GGGG_CW)` (beta1->3->5->7,
 * pro + cw) reproduces `HHHH_CW` (beta1->7->5->3, anti + cw), which is a
 * transcribed, dataframe-verified card of Austen's.
 *
 * It is NOT the LOOP "inverted" component: `invertMotion`
 * (create/services/motion-transforms.ts) flips motion type AND rotation
 * direction in place, which keeps the hand path — a different transform.
 * Flipping only the type while holding both rotation and locations is
 * impossible: that pair of rows does not exist in the dataframe.
 *
 * Involution: applying it twice restores the original positions, locations,
 * rotations, orientations and step numbers.
 */
export async function buildRotationFaithfulTwin(
  seq: SequenceData
): Promise<SequenceData> {
  const steps = [...seq.steps]
    .reverse()
    .map((step, index) => reverseStep(step, index + 1));

  const first = steps[0];
  const hold = first ? createStartPositionFromBeatStart(first) : undefined;

  const twin = updateSequenceData(seq, {
    steps,
    ...(hold && { startPosition: hold }),
    ...(hold &&
      seq.startingPosition !== undefined && {
        startingPosition: hold,
      }),
  });

  return withDerivedLetters(twin);
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/**
 * Re-derive every step's letter from its motions and rewrite `word` to match.
 *
 * `deriveSequenceLetters` keeps the existing letter when a lookup fails, which
 * is the right fallback for a spatial variant (rotation preserves the letter)
 * and is why the twin blanks its letters first.
 */
async function withDerivedLetters(seq: SequenceData): Promise<SequenceData> {
  const derived = await deriveSequenceLetters(seq);
  return updateSequenceData(derived, {
    word: deriveWordFromBeats(derived.steps),
  });
}

/**
 * Every admissible source for card B under the given liberties.
 *
 * Order is fixed (rotation, then mirror, then colour swap, then twin) so the
 * returned list — and every `id` in it — is deterministic across runs.
 */
export async function buildVariants(
  cardB: SequenceData,
  liberties: VariantLiberties
): Promise<WalkSource[]> {
  const rotations = liberties.allowRotation ? ROTATIONS : ([0] as const);
  const mirrors = liberties.allowMirror ? [false, true] : [false];
  const swaps = liberties.allowColorSwap ? [false, true] : [false];
  const twins = liberties.exploreRotationFaithful ? [false, true] : [false];

  const sources: WalkSource[] = [];

  for (const rotation of rotations) {
    const rotated = rotation ? await rotateSequence(cardB, rotation) : cardB;

    for (const mirrored of mirrors) {
      const spatial = mirrored ? await mirrorSequence(rotated) : rotated;

      for (const colorSwapped of swaps) {
        const colored = colorSwapped ? swapColors(spatial) : spatial;
        // Derived once per spatial+colour cell; the twin re-derives its own.
        const base = await withDerivedLetters(colored);

        for (const rotationFaithful of twins) {
          const variant: VariantDescriptor = {
            rotation,
            mirrored,
            colorSwapped,
            rotationFaithful,
          };
          sources.push({
            kind: "cardB",
            id: `B ${describeVariant(variant)}`,
            variant,
            sequence: rotationFaithful
              ? await buildRotationFaithfulTwin(base)
              : base,
          });
        }
      }
    }
  }

  return sources;
}
