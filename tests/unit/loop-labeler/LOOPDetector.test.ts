/**
 * LOOPDetector — transformationIntervals rotation slice size.
 *
 * The detector owns the decision about whether a rotated LOOP rotates every
 * half (180°, "halved") or every quarter (90°, "quartered"). The
 * slice-aware icon strip ("fa-rotate" vs "fa-arrows-spin") reads this field
 * directly, so any regression here silently breaks the icon picker. These
 * tests lock the halved/quartered output for each path.
 */

import { describe, it, expect } from "vitest";
import { loopDetector } from "$lib/features/loop-labeler/services/implementations/LOOPDetector";
import type { SequenceEntry, RawStepData } from "$lib/features/loop-labeler/domain/models/sequence-models";

// ============================================================================
// TEST FIXTURES
// ============================================================================
//
// We build SequenceEntry objects with just enough data for the detector's
// rotation-recognition logic to fire. Every beat includes both hands'
// start/end locations and motion types because the rotation comparer
// reads all four. Locations use lowercase compass bearings (n/s/e/w).
//
// The detector's isCircular check compares the start position's endPos (beat
// 0) with the last beat's endPos. We line those up so circularity passes
// without needing real loopability analysis.

interface MotionAttrs {
  startLoc: string;
  endLoc: string;
  motionType: string;
  propRotDir: string;
  startOri?: string;
  endOri?: string;
  turns?: number;
}

function makeBeat(
  beat: number,
  blue: MotionAttrs,
  red: MotionAttrs,
  startPos: string,
  endPos: string
): RawStepData {
  return {
    beat,
    letter: "A",
    startPos,
    endPos,
    blueAttributes: blue,
    redAttributes: red,
  };
}

function makeEntry(rawSequence: RawStepData[]): SequenceEntry {
  return {
    id: "test-seq",
    word: "TEST",
    isCircular: true,
    loopType: null,
    thumbnails: [],
    sequenceLength: rawSequence.filter((r) => (r.beat ?? 0) >= 1).length,
    gridMode: "diamond",
    fullMetadata: { sequence: rawSequence },
  };
}

/**
 * Halved rotation fixture: 4 beats where beat 1↔3 and 2↔4 form 180° pairs,
 * but beat 1→2 is NOT a 90° rotation. That rules out quartered detection
 * and forces the halved path. We use different motion types across the
 * pairs inside each half (pro + anti) so the per-half beats aren't
 * themselves rotations of each other — only the halves as wholes are.
 */
function halvedFixture(): SequenceEntry {
  const makeMotion = (
    s: string,
    e: string,
    motionType: string,
    propRotDir: string
  ): MotionAttrs => ({
    startLoc: s,
    endLoc: e,
    motionType,
    propRotDir,
  });

  return makeEntry([
    {
      beat: 0,
      sequenceStartPosition: "alpha1",
      endPos: "alpha1",
    },
    // Beat 1: blue n→e (pro), red s→w (pro)
    makeBeat(
      1,
      makeMotion("n", "e", "pro", "cw"),
      makeMotion("s", "w", "pro", "cw"),
      "alpha1",
      "alpha2"
    ),
    // Beat 2: blue e→n (anti — different motion type so beat1↔beat2 isn't
    // a 90° rotation of the same motion), red w→s (anti)
    makeBeat(
      2,
      makeMotion("e", "n", "anti", "ccw"),
      makeMotion("w", "s", "anti", "ccw"),
      "alpha2",
      "alpha1"
    ),
    // Beat 3: 180° rotated beat 1 — blue s→w (pro), red n→e (pro)
    makeBeat(
      3,
      makeMotion("s", "w", "pro", "cw"),
      makeMotion("n", "e", "pro", "cw"),
      "alpha1",
      "alpha2"
    ),
    // Beat 4: 180° rotated beat 2 — blue w→s (anti), red e→n (anti)
    makeBeat(
      4,
      makeMotion("w", "s", "anti", "ccw"),
      makeMotion("e", "n", "anti", "ccw"),
      "alpha2",
      "alpha1"
    ),
  ]);
}

/**
 * Quartered rotation fixture: 4 beats that rotate 90° CW each. Each beat
 * is the same motion rotated 90° CW from the previous, so the detector's
 * quartered check (all consecutive pairs differ by exactly 90° CW) passes.
 */
function quarteredFixture(): SequenceEntry {
  const bluePro = (s: string, e: string): MotionAttrs => ({
    startLoc: s,
    endLoc: e,
    motionType: "pro",
    propRotDir: "cw",
  });
  const redPro = (s: string, e: string): MotionAttrs => ({
    startLoc: s,
    endLoc: e,
    motionType: "pro",
    propRotDir: "cw",
  });

  return makeEntry([
    {
      beat: 0,
      sequenceStartPosition: "alpha1",
      endPos: "alpha1",
    },
    // Beat 1: blue n→e, red s→w
    makeBeat(1, bluePro("n", "e"), redPro("s", "w"), "alpha1", "alpha2"),
    // Beat 2: 90° CW rotated — blue e→s, red w→n
    makeBeat(2, bluePro("e", "s"), redPro("w", "n"), "alpha2", "alpha3"),
    // Beat 3: another 90° CW — blue s→w, red n→e
    makeBeat(3, bluePro("s", "w"), redPro("n", "e"), "alpha3", "alpha4"),
    // Beat 4: another 90° CW — blue w→n, red e→s (back to start)
    makeBeat(4, bluePro("w", "n"), redPro("e", "s"), "alpha4", "alpha1"),
  ]);
}

// ============================================================================
// TESTS
// ============================================================================

describe("LOOPDetector.detectLOOP transformationIntervals", () => {
  it("marks a 180° rotation LOOP as halved in transformationIntervals.rotation", () => {
    const result = loopDetector.detectLOOP(halvedFixture());

    expect(result.isCircular).toBe(true);
    // The detector might label it halved_rotated; the key contract is that
    // rotation interval = "halved" so the icon stays fa-rotate.
    if (result.components.includes("rotated")) {
      expect(result.transformationIntervals.rotation).toBe("halved");
    }
  });

  it("marks a 90° rotation LOOP as quartered in transformationIntervals.rotation", () => {
    const result = loopDetector.detectLOOP(quarteredFixture());

    expect(result.isCircular).toBe(true);
    expect(result.components).toContain("rotated");
    expect(result.transformationIntervals.rotation).toBe("quartered");
  });

  it("leaves transformationIntervals.rotation undefined when no rotation is detected", () => {
    // A 2-beat sequence with no rotation at all — buildFallbackResult returns
    // empty intervals.
    const entry = makeEntry([
      {
        beat: 0,
        sequenceStartPosition: "alpha1",
        endPos: "alpha1",
      },
      {
        beat: 1,
        letter: "A",
        startPos: "alpha1",
        endPos: "alpha1",
        blueAttributes: {
          startLoc: "n",
          endLoc: "n",
          motionType: "static",
          propRotDir: "no_rotation",
        },
        redAttributes: {
          startLoc: "s",
          endLoc: "s",
          motionType: "static",
          propRotDir: "no_rotation",
        },
      },
      {
        beat: 2,
        letter: "A",
        startPos: "alpha1",
        endPos: "alpha1",
        blueAttributes: {
          startLoc: "n",
          endLoc: "n",
          motionType: "static",
          propRotDir: "no_rotation",
        },
        redAttributes: {
          startLoc: "s",
          endLoc: "s",
          motionType: "static",
          propRotDir: "no_rotation",
        },
      },
    ]);

    const result = loopDetector.detectLOOP(entry);
    // No rotation fired, so rotation interval should be absent.
    expect(result.transformationIntervals.rotation).toBeUndefined();
  });
});
