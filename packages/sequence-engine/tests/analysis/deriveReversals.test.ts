/**
 * Tests for deriveReversals — THE canonical reversal detector.
 *
 * Fixtures are grounded in the MCP reversal definition (verified 2026-07-05):
 * three reversal types — hand reversal (hand retraces, prop continues),
 * prop reversal (hand continues, prop reverses), full reversal (both
 * retrace). The pro/anti data convention is proven by canonical letters A/B:
 * same blue hand path w→n (a clockwise arc); A (pro) stores rotationDirection
 * "cw", B (anti) stores "ccw". So:
 *   - pro  = rotationDirection equals the hand-arc direction
 *   - anti = rotationDirection opposes the hand-arc direction
 *
 * The detector reports TWO channels per hand:
 *   - `propReversal` — prop rotation direction flipped (prop + full
 *     reversals). THE dot display channel (Austen 2026-07-05: dots are for
 *     prop-direction reversals only).
 *   - `handReversal` — hand arc flipped (hand + full reversals). Non-display
 *     signal channel.
 *
 * Canonical chain semantics under test (adopted from production):
 *   - blank steps and noRotation/arc-less motions are TRANSPARENT — they never
 *     flag, never anchor, and do not break a signal's chain;
 *   - `loop: true` wraps: early steps look back through the sequence tail;
 *   - each signal (prop rotation, hand arc) anchors independently.
 */

import { describe, it, expect } from "vitest";
import {
  createStep,
  createStartStep,
  createMotion,
  GridPosition,
  GridLocation,
  MotionType,
  RotationDirection,
  Orientation,
  Plane,
  PropColor,
  Letter,
  type Motion,
} from "@tka/tka-types";
import { deriveReversals } from "../../src/analysis/deriveReversals.js";

type Dir = "cw" | "ccw" | "noRotation";

// Per-hand channel expectation shorthands.
const NONE = { propReversal: false, handReversal: false };
const PROP = { propReversal: true, handReversal: false };
const HAND = { propReversal: false, handReversal: true };
const FULL = { propReversal: true, handReversal: true };

function mkMotion(
  color: "blue" | "red",
  motionType: MotionType,
  start: GridLocation,
  end: GridLocation,
  rotationDirection: Dir
): Motion {
  return createMotion({
    motionType,
    startLocation: start,
    endLocation: end,
    rotationDirection:
      rotationDirection === "cw"
        ? RotationDirection.cw
        : rotationDirection === "ccw"
          ? RotationDirection.ccw
          : RotationDirection.noRotation,
    startOrientation: Orientation.in,
    endOrientation: Orientation.in,
    turns: 0,
    plane: Plane.wall,
    color: color === "blue" ? PropColor.blue : PropColor.red,
  });
}

/** A parked hand: static at one location, no rotation, no arc. Inert. */
function parked(color: "blue" | "red", at: GridLocation = GridLocation.s): Motion {
  return mkMotion(color, MotionType.static, at, at, "noRotation");
}

let stepId = 0;
function mkStep(
  stepNumber: number,
  blue: Motion,
  red: Motion,
  opts: { isBlank?: boolean } = {}
) {
  return createStep({
    id: `s${++stepId}`,
    letter: Letter.A,
    startPosition: GridPosition.alpha1,
    endPosition: GridPosition.alpha3,
    motions: { blue, red },
    stepNumber,
    duration: 1,
    ...(opts.isBlank ? { isBlank: true } : {}),
  });
}

// Canonical letter-A-shaped first step: blue hand w→n clockwise arc, prop cw (pro).
const proWN = (color: "blue" | "red") =>
  mkMotion(color, MotionType.pro, GridLocation.w, GridLocation.n, "cw");

describe("deriveReversals — basics", () => {
  it("returns an empty array for empty input", () => {
    expect(deriveReversals([])).toEqual([]);
  });

  it("marks the start-position step (stepNumber 0) as no reversal", () => {
    const start = createStartStep(GridPosition.alpha1);
    expect(deriveReversals([start])).toEqual([{ blue: NONE, red: NONE }]);
  });

  it("marks the first real step as no reversal (nothing to reverse against)", () => {
    const start = createStartStep(GridPosition.alpha1);
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    expect(deriveReversals([start, s1])).toEqual([
      { blue: NONE, red: NONE },
      { blue: NONE, red: NONE },
    ]);
  });

  it("does not flag natural continuation (hand continues arc, prop continues spin)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // n→e continues the clockwise arc; prop stays cw → pro maintained.
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.e, "cw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: NONE, red: NONE });
  });
});

describe("deriveReversals — the three MCP reversal types, per channel", () => {
  it("PROP reversal (hand continues, prop reverses) → propReversal only — this is a DOT", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // Hand continues clockwise n→e; prop flips to ccw → anti.
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.e, "ccw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: PROP, red: NONE });
  });

  it("HAND reversal (hand retraces, prop continues) → handReversal only — NOT a dot", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // Hand retraces n→w (ccw arc); prop CONTINUES cw → anti. rotationDirection
    // is unchanged cw→cw, so the dot channel must stay FALSE.
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: HAND, red: NONE });
  });

  it("FULL reversal (both retrace, pro stays pro) → both channels — this is a DOT", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // Hand retraces n→w (ccw) AND prop reverses to ccw → still pro.
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.w, "ccw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: FULL, red: NONE });
  });

  it("keeps hands independent (red continuing, blue hand-reversing)", () => {
    const s1 = mkStep(1, proWN("blue"), proWN("red"));
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"), // hand reversal
      mkMotion("red", MotionType.pro, GridLocation.n, GridLocation.e, "cw") // continuation
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: HAND, red: NONE });
  });
});

describe("deriveReversals — transparent chains (production semantics)", () => {
  it("does not flag a static (noRotation, arc-less) step", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    const s2 = mkStep(2, parked("blue", GridLocation.n), parked("red"));
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: NONE, red: NONE });
  });

  it("looks past a static step to the last active direction (chain not broken)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    const s2 = mkStep(2, parked("blue", GridLocation.n), parked("red"));
    // Hand reversal against s1, across the static s2 — signal channel only.
    const s3 = mkStep(
      3,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2, s3])[2]).toEqual({ blue: HAND, red: NONE });
  });

  it("looks past a BLANK step to the last active direction (canonical: blanks are transparent)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    const blank = mkStep(2, parked("blue", GridLocation.n), parked("red"), {
      isBlank: true,
    });
    // Prop reversal against s1 across the blank.
    const s3 = mkStep(
      3,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.e, "ccw"),
      parked("red")
    );
    const result = deriveReversals([s1, blank, s3]);
    expect(result[1]).toEqual({ blue: NONE, red: NONE }); // blank never flags
    expect(result[2]).toEqual({ blue: PROP, red: NONE }); // chain survived the blank
  });

  it("never flags nor anchors on a blank step even if it carries motion data", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // A blank carrying (bogus) active motions must stay inert.
    const blank = mkStep(
      2,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "ccw"),
      parked("red"),
      { isBlank: true }
    );
    // s3 continues s1's arc + spin → no reversal (the blank's ccw is invisible).
    const s3 = mkStep(
      3,
      mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.e, "cw"),
      parked("red")
    );
    const result = deriveReversals([s1, blank, s3]);
    expect(result[1]).toEqual({ blue: NONE, red: NONE });
    expect(result[2]).toEqual({ blue: NONE, red: NONE });
  });
});

describe("deriveReversals — loop wrap", () => {
  // Two-step loop: s1 arcs w→n cw; s2 retraces n→w with prop continuing cw
  // (hand reversal). With wrap, s1 is ALSO a hand reversal against s2's tail
  // arc (ccw → cw). Prop channel stays quiet throughout (all cw).
  const s1 = mkStep(1, proWN("blue"), parked("red"));
  const s2 = mkStep(
    2,
    mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"),
    parked("red")
  );

  it("without loop: only the interior step carries the hand signal", () => {
    expect(deriveReversals([s1, s2])).toEqual([
      { blue: NONE, red: NONE },
      { blue: HAND, red: NONE },
    ]);
  });

  it("with loop: the first step wraps and carries the hand signal too", () => {
    expect(deriveReversals([s1, s2], { loop: true })).toEqual([
      { blue: HAND, red: NONE },
      { blue: HAND, red: NONE },
    ]);
  });

  it("with loop: a uniform same-direction loop stays reversal-free", () => {
    const a = mkStep(1, mkMotion("blue", MotionType.pro, GridLocation.w, GridLocation.n, "cw"), parked("red"));
    const b = mkStep(2, mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.e, "cw"), parked("red"));
    const c = mkStep(3, mkMotion("blue", MotionType.pro, GridLocation.e, GridLocation.s, "cw"), parked("red"));
    const d = mkStep(4, mkMotion("blue", MotionType.pro, GridLocation.s, GridLocation.w, "cw"), parked("red"));
    expect(deriveReversals([a, b, c, d], { loop: true })).toEqual([
      { blue: NONE, red: NONE },
      { blue: NONE, red: NONE },
      { blue: NONE, red: NONE },
      { blue: NONE, red: NONE },
    ]);
  });

  it("with loop: alternating prop spin flags the DOT channel on every step (findings-doc AB chain)", () => {
    // Same hand arc every step (all cw around the grid), prop alternating
    // cw/ccw — a genuine prop-reversal chain; every step dots, including the
    // first via wrap. Hand channel stays quiet (arcs never flip).
    const a = mkStep(1, mkMotion("blue", MotionType.pro, GridLocation.w, GridLocation.n, "cw"), parked("red"));
    const b = mkStep(2, mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.e, "ccw"), parked("red"));
    const c = mkStep(3, mkMotion("blue", MotionType.pro, GridLocation.e, GridLocation.s, "cw"), parked("red"));
    const d = mkStep(4, mkMotion("blue", MotionType.anti, GridLocation.s, GridLocation.w, "ccw"), parked("red"));
    expect(deriveReversals([a, b, c, d], { loop: true })).toEqual([
      { blue: PROP, red: NONE },
      { blue: PROP, red: NONE },
      { blue: PROP, red: NONE },
      { blue: PROP, red: NONE },
    ]);
  });
});

describe("deriveReversals — rotation-only data (no usable locations)", () => {
  // Steps whose motions carry rotation but whose locations are static-shaped
  // exercise the pure prop-rotation (dot) path — the legacy behavior must hold.
  function spinOnly(stepNumber: number, blueDir: Dir, redDir: Dir) {
    return mkStep(
      stepNumber,
      mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.n, blueDir),
      mkMotion("red", MotionType.pro, GridLocation.n, GridLocation.n, redDir)
    );
  }

  it("flags prop flips on the dot channel exactly as the legacy detector did", () => {
    const result = deriveReversals([
      spinOnly(1, "cw", "ccw"),
      spinOnly(2, "ccw", "ccw"),
      spinOnly(3, "ccw", "cw"),
      spinOnly(4, "noRotation", "cw"),
      spinOnly(5, "cw", "cw"),
    ]);
    expect(result).toEqual([
      { blue: NONE, red: NONE },
      { blue: PROP, red: NONE }, // blue cw→ccw
      { blue: NONE, red: PROP }, // red ccw→cw
      { blue: NONE, red: NONE }, // noRotation current never flags
      { blue: PROP, red: NONE }, // blue ccw→cw across the noRotation step
    ]);
  });
});
