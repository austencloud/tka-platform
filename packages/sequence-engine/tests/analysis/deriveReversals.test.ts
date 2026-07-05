/**
 * Tests for deriveReversals — THE canonical reversal detector.
 *
 * Fixtures are grounded in the MCP reversal definition (verified 2026-07-05):
 * three reversal types — hand reversal (hand retraces, prop continues),
 * prop reversal (hand continues, prop reverses), full reversal (both
 * retrace) — all flagged. The pro/anti data convention is proven by canonical
 * letters A/B: same blue hand path w→n (a clockwise arc); A (pro) stores
 * rotationDirection "cw", B (anti) stores "ccw". So:
 *   - pro  = rotationDirection equals the hand-arc direction
 *   - anti = rotationDirection opposes the hand-arc direction
 *
 * Canonical semantics under test (adopted from the production app detector):
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
    expect(deriveReversals([start])).toEqual([{ blue: false, red: false }]);
  });

  it("marks the first real step as no reversal (nothing to reverse against)", () => {
    const start = createStartStep(GridPosition.alpha1);
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    const result = deriveReversals([start, s1]);
    expect(result).toEqual([
      { blue: false, red: false },
      { blue: false, red: false },
    ]);
  });

  it("does not flag natural continuation (hand continues arc, prop continues spin)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // n→e continues the clockwise arc; prop stays cw → pro maintained, no reversal.
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.e, "cw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: false, red: false });
  });
});

describe("deriveReversals — the three MCP reversal types", () => {
  it("flags a PROP reversal (hand continues, prop reverses — was already caught)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // Hand continues clockwise n→e; prop flips to ccw → anti (prop opposes arc).
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.e, "ccw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: true, red: false });
  });

  it("flags a HAND reversal (hand retraces, prop continues — the previously missed type)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // Hand retraces n→w (ccw arc); prop CONTINUES cw → anti (prop now opposes arc).
    // rotationDirection is unchanged (cw → cw): the rotation-only detector was
    // blind to exactly this case.
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: true, red: false });
  });

  it("flags a FULL reversal (both retrace — pro stays pro)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    // Hand retraces n→w (ccw) AND prop reverses to ccw → still pro.
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.w, "ccw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: true, red: false });
  });

  it("keeps hands independent (red parked throughout, blue reversing)", () => {
    const s1 = mkStep(1, proWN("blue"), proWN("red"));
    const s2 = mkStep(
      2,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"), // hand reversal
      mkMotion("red", MotionType.pro, GridLocation.n, GridLocation.e, "cw") // continuation
    );
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: true, red: false });
  });
});

describe("deriveReversals — transparent chains (production semantics)", () => {
  it("does not flag a static (noRotation, arc-less) step", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    const s2 = mkStep(2, parked("blue", GridLocation.n), parked("red"));
    expect(deriveReversals([s1, s2])[1]).toEqual({ blue: false, red: false });
  });

  it("looks past a static step to the last active direction (chain not broken)", () => {
    const s1 = mkStep(1, proWN("blue"), parked("red"));
    const s2 = mkStep(2, parked("blue", GridLocation.n), parked("red"));
    // Hand reversal against s1, across the static s2.
    const s3 = mkStep(
      3,
      mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"),
      parked("red")
    );
    expect(deriveReversals([s1, s2, s3])[2]).toEqual({ blue: true, red: false });
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
    expect(result[1]).toEqual({ blue: false, red: false }); // blank never flags
    expect(result[2]).toEqual({ blue: true, red: false }); // chain survived the blank
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
    expect(result[1]).toEqual({ blue: false, red: false });
    expect(result[2]).toEqual({ blue: false, red: false });
  });
});

describe("deriveReversals — loop wrap", () => {
  // Two-step loop: s1 arcs w→n cw; s2 retraces n→w with prop continuing cw
  // (hand reversal). With wrap, s1 is ALSO a hand reversal against s2's tail
  // arc (ccw → cw).
  const s1 = mkStep(1, proWN("blue"), parked("red"));
  const s2 = mkStep(
    2,
    mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.w, "cw"),
    parked("red")
  );

  it("without loop: only the interior step flags", () => {
    expect(deriveReversals([s1, s2])).toEqual([
      { blue: false, red: false },
      { blue: true, red: false },
    ]);
  });

  it("with loop: the first step wraps and flags against the tail", () => {
    expect(deriveReversals([s1, s2], { loop: true })).toEqual([
      { blue: true, red: false },
      { blue: true, red: false },
    ]);
  });

  it("with loop: a uniform same-direction loop stays reversal-free", () => {
    // Four pro steps chasing clockwise around the grid — wrap finds only
    // matching directions.
    const a = mkStep(1, mkMotion("blue", MotionType.pro, GridLocation.w, GridLocation.n, "cw"), parked("red"));
    const b = mkStep(2, mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.e, "cw"), parked("red"));
    const c = mkStep(3, mkMotion("blue", MotionType.pro, GridLocation.e, GridLocation.s, "cw"), parked("red"));
    const d = mkStep(4, mkMotion("blue", MotionType.pro, GridLocation.s, GridLocation.w, "cw"), parked("red"));
    expect(deriveReversals([a, b, c, d], { loop: true })).toEqual([
      { blue: false, red: false },
      { blue: false, red: false },
      { blue: false, red: false },
      { blue: false, red: false },
    ]);
  });

  it("with loop: alternating prop spin flags every step (findings-doc AB chain)", () => {
    // Same hand arc every step (all cw around the grid), prop alternating
    // cw/ccw — a genuine prop-reversal chain; every step flags, including the
    // first via wrap.
    const a = mkStep(1, mkMotion("blue", MotionType.pro, GridLocation.w, GridLocation.n, "cw"), parked("red"));
    const b = mkStep(2, mkMotion("blue", MotionType.anti, GridLocation.n, GridLocation.e, "ccw"), parked("red"));
    const c = mkStep(3, mkMotion("blue", MotionType.pro, GridLocation.e, GridLocation.s, "cw"), parked("red"));
    const d = mkStep(4, mkMotion("blue", MotionType.anti, GridLocation.s, GridLocation.w, "ccw"), parked("red"));
    expect(deriveReversals([a, b, c, d], { loop: true })).toEqual([
      { blue: true, red: false },
      { blue: true, red: false },
      { blue: true, red: false },
      { blue: true, red: false },
    ]);
  });
});

describe("deriveReversals — rotation-only data (no usable locations)", () => {
  // Steps whose motions carry rotation but whose locations are static-shaped
  // exercise the pure prop-rotation path — the legacy behavior must hold.
  function spinOnly(stepNumber: number, blueDir: Dir, redDir: Dir) {
    return mkStep(
      stepNumber,
      mkMotion("blue", MotionType.pro, GridLocation.n, GridLocation.n, blueDir),
      mkMotion("red", MotionType.pro, GridLocation.n, GridLocation.n, redDir)
    );
  }

  it("flags prop flips exactly as the legacy rotation-only detector did", () => {
    const result = deriveReversals([
      spinOnly(1, "cw", "ccw"),
      spinOnly(2, "ccw", "ccw"),
      spinOnly(3, "ccw", "cw"),
      spinOnly(4, "noRotation", "cw"),
      spinOnly(5, "cw", "cw"),
    ]);
    expect(result).toEqual([
      { blue: false, red: false },
      { blue: true, red: false }, // blue cw→ccw
      { blue: false, red: true }, // red ccw→cw
      { blue: false, red: false }, // noRotation current never flags
      { blue: true, red: false }, // blue ccw→cw across the noRotation step
    ]);
  });
});
