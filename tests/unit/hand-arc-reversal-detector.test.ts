/**
 * Hand-Arc-Aware Reversal Detector — app-level proof
 * ===================================================
 *
 * Exercises the production `processReversals` / option-preview API after the
 * 2026-07-05 consolidation onto the canonical engine detector
 * (`deriveReversals` in @tka/sequence-engine).
 *
 * Fixtures are grounded in MCP definitions (verified 2026-07-05):
 *   - pro = prop rotates the SAME direction as the hand's arc; anti = opposite.
 *     Proven by canonical letters A/B: identical blue hand path w→n (clockwise
 *     arc); A (pro) stores rotationDirection "cw", B (anti) stores "ccw".
 *   - reversal types: HAND (hand retraces, prop continues), PROP (hand
 *     continues, prop reverses), FULL (both retrace). All three get dots.
 *
 * The rotation-only detector this replaces caught prop + full reversals but
 * missed hand reversals (rotationDirection unchanged). These tests prove the
 * miss is closed and the legacy behavior is preserved.
 */

import { describe, expect, it } from "vitest";
import {
  processReversals,
  detectReversalForOption,
  detectReversalsForOptions,
} from "../../src/lib/shared/create/services/reversal-detector";
import type { StepData } from "../../src/lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import type { PictographData } from "../../src/lib/shared/pictograph/shared/domain/models/pictograph-data";

type MotionLite = {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
  handPath?: string | null;
};

function motion(
  motionType: string,
  startLocation: string,
  endLocation: string,
  rotationDirection: string,
  handPath?: string
): MotionLite {
  return { motionType, startLocation, endLocation, rotationDirection, ...(handPath ? { handPath } : {}) };
}

/** Parked hand: static, no travel, no spin — inert on both signals. */
const parked = (): MotionLite => motion("static", "s", "s", "noRotation");

function step(num: number, blue: MotionLite, red: MotionLite, isBlank = false): StepData {
  return {
    id: `beat-${num}`,
    stepNumber: num,
    duration: 1.0,
    blueReversal: false,
    redReversal: false,
    isBlank,
    letter: null,
    startPosition: null,
    endPosition: null,
    motions: { blue: blue as never, red: red as never },
  } as unknown as StepData;
}

function seq(steps: StepData[], loopType?: string): SequenceData {
  return {
    id: "seq",
    name: "Test",
    word: "",
    steps,
    thumbnails: [],
    isFavorite: false,
    isCircular: !!loopType,
    ...(loopType ? { loopType } : {}),
    level: 2,
    difficultyLevel: "intermediate",
    tags: [],
    metadata: {},
  } as unknown as SequenceData;
}

// Letter-A-shaped opener: blue hand w→n (clockwise arc), prop cw → pro.
const proOpener = () => motion("pro", "w", "n", "cw");

describe("processReversals — three reversal types (MCP-grounded)", () => {
  it("HAND reversal: hand retraces, prop continues — now flagged (was the false negative)", () => {
    // Step 2: hand retraces n→w (ccw arc), prop CONTINUES cw → anti.
    // rotationDirection is unchanged cw→cw; the old detector saw nothing.
    const result = processReversals(
      seq([step(1, proOpener(), parked()), step(2, motion("anti", "n", "w", "cw"), parked())])
    );
    expect(result.steps[1]!.blueReversal).toBe(true);
    expect(result.steps[1]!.redReversal).toBe(false);
  });

  it("PROP reversal: hand continues, prop reverses — still flagged", () => {
    const result = processReversals(
      seq([step(1, proOpener(), parked()), step(2, motion("anti", "n", "e", "ccw"), parked())])
    );
    expect(result.steps[1]!.blueReversal).toBe(true);
    expect(result.steps[1]!.redReversal).toBe(false);
  });

  it("FULL reversal: both retrace (pro stays pro) — still flagged", () => {
    const result = processReversals(
      seq([step(1, proOpener(), parked()), step(2, motion("pro", "n", "w", "ccw"), parked())])
    );
    expect(result.steps[1]!.blueReversal).toBe(true);
  });

  it("natural continuation: hand continues arc, prop continues spin — no dot", () => {
    const result = processReversals(
      seq([step(1, proOpener(), parked()), step(2, motion("pro", "n", "e", "cw"), parked())])
    );
    expect(result.steps[1]!.blueReversal).toBe(false);
    expect(result.steps[1]!.redReversal).toBe(false);
  });

  it("FLOAT hand reversal via authored handPath (no prop rotation to compare)", () => {
    // Two floats: hand arcs cw then retraces ccw; rotationDirection is
    // noRotation on both, so only the authored hand path can see the flip.
    const result = processReversals(
      seq([
        step(1, motion("float", "w", "n", "noRotation", "cw"), parked()),
        step(2, motion("float", "n", "w", "noRotation", "ccw"), parked()),
      ])
    );
    expect(result.steps[1]!.blueReversal).toBe(true);
  });

  it("loop wrap: first step flags a hand reversal against the sequence tail", () => {
    const steps = [
      step(1, proOpener(), parked()),
      step(2, motion("anti", "n", "w", "cw"), parked()),
    ];
    const looped = processReversals(seq(steps, "rotated"));
    expect(looped.steps[0]!.blueReversal).toBe(true); // via wrap
    expect(looped.steps[1]!.blueReversal).toBe(true);

    const linear = processReversals(seq(steps));
    expect(linear.steps[0]!.blueReversal).toBe(false); // no wrap without loopType
    expect(linear.steps[1]!.blueReversal).toBe(true);
  });

  it("blanks stay transparent and never flag (production semantics preserved)", () => {
    const result = processReversals(
      seq([
        step(1, proOpener(), parked()),
        step(2, parked(), parked(), true), // blank
        step(3, motion("anti", "n", "w", "cw"), parked()), // hand reversal across the blank
      ])
    );
    expect(result.steps[1]!.blueReversal).toBe(false);
    expect(result.steps[2]!.blueReversal).toBe(true);
  });
});

describe("option previews — hand-arc aware", () => {
  const currentSequence = [step(1, proOpener(), parked())];

  it("detectReversalForOption flags a hand-reversal option", () => {
    const option = {
      motions: {
        blue: motion("anti", "n", "w", "cw"), // hand retraces, prop continues
        red: parked(),
      },
    } as unknown as PictographData;
    expect(detectReversalForOption(currentSequence, option)).toEqual({
      blueReversal: true,
      redReversal: false,
    });
  });

  it("detectReversalForOption stays quiet on a continuation option", () => {
    const option = {
      motions: {
        blue: motion("pro", "n", "e", "cw"),
        red: parked(),
      },
    } as unknown as PictographData;
    expect(detectReversalForOption(currentSequence, option)).toEqual({
      blueReversal: false,
      redReversal: false,
    });
  });

  it("detectReversalsForOptions annotates hand, prop, and continuation options correctly", () => {
    const sequencePictographs = [
      { motions: { blue: proOpener(), red: parked() } },
    ] as unknown as PictographData[];
    const options = [
      { motions: { blue: motion("anti", "n", "w", "cw"), red: parked() } }, // hand reversal
      { motions: { blue: motion("anti", "n", "e", "ccw"), red: parked() } }, // prop reversal
      { motions: { blue: motion("pro", "n", "e", "cw"), red: parked() } }, // continuation
    ] as unknown as PictographData[];

    const annotated = detectReversalsForOptions(sequencePictographs, options);
    expect(annotated.map((o) => o.blueReversal)).toEqual([true, true, false]);
    expect(annotated.map((o) => o.redReversal)).toEqual([false, false, false]);
  });

  it("returns all-false for an empty sequence", () => {
    const options = [
      { motions: { blue: motion("pro", "n", "e", "cw"), red: parked() } },
    ] as unknown as PictographData[];
    expect(detectReversalsForOptions([], options)[0]!.blueReversal).toBe(false);
  });
});
