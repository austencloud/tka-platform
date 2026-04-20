/**
 * SequenceHydrator round-trip smoke test.
 *
 * Protects against the regression class that bit us on 2026-04-19:
 * a shortcode resolves to a sequence whose motions are intact but
 * whose semantic fields (word, loopType, isCircular, gridMode) come
 * back empty, breaking the viewer footer and loop-type badge.
 *
 * The test encodes a hand-built sequence, decodes it, feeds the
 * decoded form through `hydrateSequence` with the real pure-client
 * derivers (position, gridMode, loop) plus a stubbed letter deriver
 * (the real one needs the pictograph dataframe loaded — out of scope
 * for a smoke test). Asserts the derived fields come back populated.
 */

import { describe, expect, it } from "vitest";

import { SequenceEncoder } from "$lib/shared/navigation/services/implementations/SequenceEncoder";
import { PositionDeriver } from "$lib/shared/navigation/services/implementations/PositionDeriver";
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";
import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
import { hydrateSequence } from "$lib/shared/navigation/services/implementations/SequenceHydrator";

import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// ============================================================================
// FIXTURES
// ============================================================================

function makeStep(
  stepNumber: number,
  blue: Partial<Parameters<typeof createMotionData>[0]>,
  red: Partial<Parameters<typeof createMotionData>[0]>
): StepData {
  return {
    id: `step-${stepNumber}`,
    stepNumber,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter: null,
    startPosition: null,
    endPosition: null,
    motions: {
      blue: createMotionData({ ...blue, color: MotionColor.BLUE }),
      red: createMotionData({ ...red, color: MotionColor.RED }),
    },
  };
}

/** Cardinal-only sequence → gridMode must come back as "diamond". */
function buildDiamondSequence(): SequenceData {
  const start = makeStep(
    0,
    {
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.NORTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      propType: PropType.STAFF,
    },
    {
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.SOUTH,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      propType: PropType.STAFF,
    }
  );

  const step1 = makeStep(
    1,
    {
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.EAST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      propType: PropType.STAFF,
    },
    {
      motionType: MotionType.PRO,
      rotationDirection: RotationDirection.CLOCKWISE,
      startLocation: GridLocation.SOUTH,
      endLocation: GridLocation.WEST,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      turns: 0,
      propType: PropType.STAFF,
    }
  );

  return createSequenceData({
    word: "",
    name: "",
    steps: [step1],
    startPosition: {
      id: start.id,
      letter: start.letter,
      gridPosition: start.startPosition,
      startPosition: start.startPosition,
      endPosition: start.endPosition,
      motions: start.motions,
    },
    startingPosition: {
      id: start.id,
      letter: start.letter,
      gridPosition: start.startPosition,
      startPosition: start.startPosition,
      endPosition: start.endPosition,
      motions: start.motions,
    },
  });
}

/**
 * Stub letter deriver — the real one loads the full pictograph
 * dataframe, which is out of scope for a smoke test. This stub just
 * stamps deterministic letters + the derived word so we can verify
 * the hydrator wires the letter pass's output through correctly.
 */
const stubLetterDeriver: ILetterDeriver = {
  async deriveLettersForSequence(sequence: SequenceData): Promise<SequenceData> {
    const steps = sequence.steps.map((step, i) => ({
      ...step,
      letter: String.fromCharCode(65 + i),
    }));
    return {
      ...sequence,
      steps,
      word: steps.map((s) => s.letter).join(""),
    };
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe("hydrateSequence — encode/decode round-trip", () => {
  it("restores gridMode, word, and per-step letter/positions after decode", async () => {
    const encoder = new SequenceEncoder();
    const positionDeriver = new PositionDeriver(gridPositionDeriver);

    const original = buildDiamondSequence();

    // Simulate the live path: encode → compress → decompress → decode.
    // `decodeWithCompression` is what every resolver actually calls.
    const { encoded } = encoder.encodeWithCompression(original);
    const decoded = encoder.decodeWithCompression(encoded);

    // Sanity check — the decoded sequence should have the raw motion
    // primitives but none of the derived fields yet. If this assertion
    // ever fails it means the encoder itself started shipping metadata,
    // which would invalidate the derive-at-decode architecture.
    expect(decoded.word).toBe("");
    expect(decoded.steps[0]?.letter).toBeNull();
    expect(decoded.steps[0]?.startPosition).toBeNull();

    // Hydrate with the real pure-client derivers (position + loop +
    // gridMode) and a stubbed letter deriver.
    const hydrated = await hydrateSequence(decoded, {
      letterDeriver: stubLetterDeriver,
      positionDeriver,
      loopDetector,
      gridModeDeriver,
    });

    // Letter deriver populated word + per-step letters.
    expect(hydrated.word).toBe("A");
    expect(hydrated.steps[0]?.letter).toBe("A");

    // Position deriver populated per-step positions.
    expect(hydrated.steps[0]?.startPosition).toBeTruthy();
    expect(hydrated.steps[0]?.endPosition).toBeTruthy();

    // GridMode inferred from cardinal-only locations.
    expect(hydrated.gridMode).toBe("diamond");

    // Loop detector ran (short sequence — not circular, not a LOOP type).
    expect(hydrated.isCircular).toBe(false);

    // Hydration stamp so downstream reactivity can distinguish hydrated
    // from unhydrated sequences.
    expect(hydrated.metadata._hydratedAt).toBeTypeOf("number");
  });

  it("preserves fractional turns (0.5) through encode → decode", () => {
    // Regression: LPhOrr scanned 2026-04-20 rendered with arrows in the wrong
    // tier because the decoder used parseInt(turnsCode, 10), which floors "0.5"
    // to 0. Every anti motion with half-turns came back as 0-turn, silently.
    // The diagnostic format (ClaudeCodeCopier) surfaced t=0 everywhere even
    // though Firestore had turns=0.5.
    const encoder = new SequenceEncoder();

    const original = createSequenceData({
      word: "",
      name: "",
      steps: [
        makeStep(
          1,
          {
            motionType: MotionType.ANTI,
            rotationDirection: RotationDirection.COUNTER_CLOCKWISE,
            startLocation: GridLocation.SOUTH,
            endLocation: GridLocation.WEST,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.COUNTER,
            turns: 0.5,
            propType: PropType.STAFF,
          },
          {
            motionType: MotionType.STATIC,
            rotationDirection: RotationDirection.NO_ROTATION,
            startLocation: GridLocation.NORTH,
            endLocation: GridLocation.NORTH,
            startOrientation: Orientation.IN,
            endOrientation: Orientation.IN,
            turns: 0,
            propType: PropType.STAFF,
          }
        ),
      ],
    });

    const { encoded } = encoder.encodeWithCompression(original);
    const decoded = encoder.decodeWithCompression(encoded);

    expect(decoded.steps[0]?.motions.blue.turns).toBe(0.5);
    expect(decoded.steps[0]?.motions.red.turns).toBe(0);
  });
});
