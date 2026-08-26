import { describe, expect, it } from "vitest";

import {
  AUDIENCE_FACING_ANGLE,
  MAX_TRAVEL_SPEED,
  compileBlockingMoves,
  type DirectorBlockingMove,
} from "../../../src/routes/test/film-director/_lib/blocking-language";

const CONTEXT = {
  durationSeconds: 8,
  performerId: "performer-1",
  startPosition: { x: 0, z: 0 },
  startFacingAngle: AUDIENCE_FACING_ANGLE,
};

function compile(moves: DirectorBlockingMove[], overrides = {}) {
  return compileBlockingMoves(moves, { ...CONTEXT, ...overrides });
}

/** Where the performer's own left/right/forward/back point in world space. */
function axis(facingAngle: number) {
  const sin = Math.sin(facingAngle);
  const cos = Math.cos(facingAngle);
  return {
    forward: { x: sin, z: cos },
    backward: { x: -sin, z: -cos },
    right: { x: cos, z: -sin },
    left: { x: -cos, z: sin },
  };
}

describe("compileBlockingMoves", () => {
  it("an empty list holds the opening pose for the whole scene", () => {
    const frames = compile([]);
    expect(frames).toHaveLength(2);
    expect(frames[0]!.atSeconds).toBe(0);
    expect(frames[1]!.atSeconds).toBe(8);
    expect(frames.every((frame) => frame.walking)).toBe(false);
    expect(frames[1]!.position).toEqual({ x: 0, z: 0 });
  });

  it("a single move with no stated duration fills the scene", () => {
    const frames = compile([{ move: "walk", direction: "forward" }]);
    expect(frames.at(-1)!.atSeconds).toBeCloseTo(8, 6);
  });

  it("moves that state durations split the scene in stated order", () => {
    const frames = compile([
      { move: "stand", durationSeconds: 2 },
      { move: "walk", direction: "forward", durationSeconds: 3 },
      { move: "stand", durationSeconds: 3 },
    ]);
    expect(frames.map((frame) => frame.atSeconds)).toEqual([0, 2, 5, 8]);
  });

  it("stated durations shorter than the scene hold the last pose to the end", () => {
    const frames = compile([
      { move: "walk", direction: "forward", amount: { meters: 1 }, durationSeconds: 2 },
    ]);
    const last = frames.at(-1)!;
    expect(last.atSeconds).toBeCloseTo(8, 6);
    expect(last.walking).toBe(false);
    expect(last.position).toEqual(frames[1]!.position);
    // Cloned, not shared: mutating the hold must not rewrite the arrival.
    expect(last.position).not.toBe(frames[1]!.position);
  });

  it("rejects moves whose stated durations exceed the scene", () => {
    expect(() =>
      compile([
        { move: "stand", durationSeconds: 5 },
        { move: "stand", durationSeconds: 5 },
      ])
    ).toThrow(/total 10s but the scene's duration is 8s/);
  });

  it("walks the stated distance along the performer's own axes", () => {
    const facing = AUDIENCE_FACING_ANGLE;
    const expected = axis(facing);
    for (const direction of ["forward", "backward", "left", "right"] as const) {
      const frames = compile([
        { move: "walk", direction, amount: { meters: 3 } },
      ]);
      const arrival = frames.at(-1)!.position;
      expect(arrival.x).toBeCloseTo(expected[direction].x * 3, 6);
      expect(arrival.z).toBeCloseTo(expected[direction].z * 3, 6);
    }
  });

  it("a relative walk holds the facing, so backward means backing up", () => {
    const frames = compile([
      { move: "walk", direction: "backward", amount: { meters: 2 } },
    ]);
    expect(frames.at(-1)!.facingAngle).toBeCloseTo(AUDIENCE_FACING_ANGLE, 6);
  });

  it("a walk to a mark faces where it is going", () => {
    const frames = compile([{ move: "walk", to: { x: 0, z: 4 } }]);
    // +Z travel with no lateral component is facing angle 0.
    expect(frames.at(-1)!.facingAngle).toBeCloseTo(0, 6);
  });

  it("an explicit facing on a walk to a mark overrides looking where it goes", () => {
    const frames = compile([
      { move: "walk", to: { x: 0, z: 4 }, facing: "audience" },
    ]);
    expect(frames.at(-1)!.facingAngle).toBeCloseTo(AUDIENCE_FACING_ANGLE, 6);
  });

  it("turn right increases the facing angle, turn left decreases it", () => {
    const right = compile([
      { move: "turn", direction: "right", amount: { degrees: 90 } },
    ]);
    const left = compile([
      { move: "turn", direction: "left", amount: { degrees: 90 } },
    ]);
    expect(right.at(-1)!.facingAngle).toBeCloseTo(
      AUDIENCE_FACING_ANGLE + Math.PI / 2,
      6
    );
    expect(left.at(-1)!.facingAngle).toBeCloseTo(
      AUDIENCE_FACING_ANGLE - Math.PI / 2,
      6
    );
  });

  it("a turn does not travel", () => {
    const frames = compile([{ move: "turn", direction: "right" }]);
    expect(frames.every((frame) => frame.walking)).toBe(false);
    expect(frames.at(-1)!.position).toEqual({ x: 0, z: 0 });
  });

  it("a later move starts from where the previous one left off", () => {
    const frames = compile([
      { move: "walk", direction: "forward", amount: { meters: 2 }, durationSeconds: 4 },
      { move: "walk", direction: "forward", amount: { meters: 2 }, durationSeconds: 4 },
    ]);
    const forward = axis(AUDIENCE_FACING_ANGLE).forward;
    const arrival = frames.at(-1)!.position;
    expect(arrival.x).toBeCloseTo(forward.x * 4, 6);
    expect(arrival.z).toBeCloseTo(forward.z * 4, 6);
  });

  it("back-to-back moves share one keyframe at the seam", () => {
    const frames = compile([
      { move: "walk", direction: "forward", durationSeconds: 4 },
      { move: "stand", durationSeconds: 4 },
    ]);
    const times = frames.map((frame) => frame.atSeconds);
    expect(times).toEqual([...new Set(times)]);
    expect(times).toEqual([0, 4, 8]);
  });

  it("marks only the travelling segment as walking", () => {
    const frames = compile([
      { move: "stand", durationSeconds: 2 },
      { move: "walk", direction: "forward", durationSeconds: 4 },
      { move: "stand", durationSeconds: 2 },
    ]);
    expect(frames.map((frame) => frame.walking)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("defaults to constant speed so the walk clip matches the ground", () => {
    const frames = compile([{ move: "walk", direction: "forward" }]);
    expect(frames[0]!.easing).toBe("linear");
  });

  it("rejects travel faster than a person can walk", () => {
    expect(() =>
      compile([
        { move: "walk", direction: "forward", amount: { meters: 40 }, durationSeconds: 2 },
      ])
    ).toThrow(/Travel tops out at/);
  });

  it("allows travel right up to the walkable ceiling", () => {
    const meters = MAX_TRAVEL_SPEED * 2;
    expect(() =>
      compile([{ move: "walk", direction: "forward", amount: { meters }, durationSeconds: 2 }])
    ).not.toThrow();
  });

  it("rejects a destination and a direction in the same move", () => {
    expect(() =>
      compile([{ move: "walk", to: { x: 1, z: 1 }, direction: "forward" }])
    ).toThrow(/either a destination or a direction and amount/);
  });

  it("rejects a destination on a move that cannot travel", () => {
    expect(() => compile([{ move: "turn", to: { x: 1, z: 1 } }])).toThrow(
      /does not take a destination/
    );
  });

  it("rejects the wrong unit for a move", () => {
    expect(() =>
      compile([{ move: "walk", direction: "forward", amount: { degrees: 90 } }])
    ).toThrow(/takes meters, not degrees/);
    expect(() =>
      compile([{ move: "turn", direction: "right", amount: { meters: 2 } }])
    ).toThrow(/takes degrees, not meters/);
  });

  it("rejects a direction a move does not understand", () => {
    expect(() =>
      compile([{ move: "turn", direction: "forward" }])
    ).toThrow(/direction must be one of left\/right/);
  });

  it("rejects a turn with nothing to turn toward", () => {
    expect(() => compile([{ move: "turn" }])).toThrow(
      /needs a direction \(left\/right\) or a facing/
    );
  });

  it("rejects a turn that faces its travel, because a turn has none", () => {
    expect(() =>
      compile([{ move: "turn", direction: "right", facing: "travel" }])
    ).toThrow(/cannot face "travel"/);
  });

  it("names the performer in its errors", () => {
    expect(() =>
      compile([{ move: "turn" }], { performerId: "fan-girl-2" })
    ).toThrow(/Performer "fan-girl-2"/);
  });
});
