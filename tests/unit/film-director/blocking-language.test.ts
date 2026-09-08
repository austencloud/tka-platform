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

describe("run", () => {
  it("rejects and names the single walk clip and the skate ceiling", () => {
    expect(() =>
      compile([{ move: "run", to: { x: 0, z: 4 } }] as DirectorBlockingMove[])
    ).toThrow(
      /"run" is not a gait the 3D locomotion has\. There is one walk clip, time-warped to the ground, and past 2\.6 m\/s the feet skate\. Write a "walk"\./
    );
  });

  it("rejects even when the distance would be walkable", () => {
    expect(() =>
      compile([{ move: "run", to: { x: 0, z: 1 } }] as DirectorBlockingMove[])
    ).toThrow(/"run" is not a gait/);
  });
});

describe("arc paths", () => {
  /** Straight-line distance walked between consecutive keyframes. */
  function legs(frames: { position: { x: number; z: number } }[]) {
    return frames.slice(1).map((frame, index) => {
      const previous = frames[index]!.position;
      return Math.hypot(
        frame.position.x - previous.x,
        frame.position.z - previous.z
      );
    });
  }

  it("bows off the straight line and still lands exactly on the mark", () => {
    const frames = compile([
      { move: "walk", to: { x: 4, z: 0 }, along: { arc: "left" } },
    ]);
    expect(frames.at(-1)!.position).toEqual({ x: 4, z: 0 });
    expect(frames[0]!.position).toEqual({ x: 0, z: 0 });
    // Default bulge 0.5 is a semicircle over the 4m chord: every keyframe
    // sits on the circle of radius 2 centred on the middle of the chord.
    for (const frame of frames) {
      expect(
        Math.hypot(frame.position.x - 2, frame.position.z - 0)
      ).toBeCloseTo(2, 6);
    }
    // Its apex is one sagitta (0.5 x 4m = 2m) off the chord. The sampled
    // polyline approaches that from inside, because an odd chord count
    // straddles the halfway angle instead of landing on it.
    const apex = Math.max(...frames.map((frame) => Math.abs(frame.position.z)));
    expect(apex).toBeLessThanOrEqual(2);
    expect(apex).toBeGreaterThan(1.98);
  });

  it("bows to the opposite side for the opposite arc", () => {
    const left = compile([
      { move: "walk", to: { x: 4, z: 0 }, along: { arc: "left" } },
    ]);
    const right = compile([
      { move: "walk", to: { x: 4, z: 0 }, along: { arc: "right" } },
    ]);
    const leftMid = left[Math.floor(left.length / 2)]!.position;
    const rightMid = right[Math.floor(right.length / 2)]!.position;
    expect(Math.sign(leftMid.z)).toBe(-Math.sign(rightMid.z));
    expect(leftMid.x).toBeCloseTo(rightMid.x, 6);
  });

  it("walks the arc at a constant speed", () => {
    const frames = compile([
      { move: "walk", to: { x: 4, z: 0 }, along: { arc: "left", bulge: 0.3 } },
    ]);
    const lengths = legs(frames.slice(0, -1));
    for (const length of lengths) {
      expect(length).toBeCloseTo(lengths[0]!, 6);
    }
    const times = frames
      .slice(0, -1)
      .map((frame, index, all) =>
        index === 0 ? null : frame.atSeconds - all[index - 1]!.atSeconds
      )
      .filter((value): value is number => value !== null);
    for (const step of times) {
      expect(step).toBeCloseTo(times[0]!, 6);
    }
  });

  it("chops the arc into at least four and at most sixteen chords", () => {
    const tiny = compile([
      { move: "walk", to: { x: 0.4, z: 0 }, along: { arc: "left" } },
    ]);
    // 4 chords + the arrival frame; the trailing hold to the scene end is a
    // duplicate of the arrival, so count unique positions instead.
    expect(tiny.filter((frame) => frame.walking).length).toBe(4);

    const long = compile(
      [{ move: "walk", to: { x: 20, z: 0 }, along: { arc: "left", bulge: 1.5 } }],
      { durationSeconds: 60 }
    );
    expect(long.filter((frame) => frame.walking).length).toBe(16);
  });

  it("faces the tangent all the way round when facing travel", () => {
    const frames = compile([
      { move: "walk", to: { x: 4, z: 0 }, along: { arc: "left" }, facing: "travel" },
    ]);
    // A semicircle turns the traveller through pi radians end to end. The
    // arrival keyframe carries the arc's own final tangent, and the move
    // fills the scene, so there is no trailing hold after it.
    const turned = frames.at(-1)!.facingAngle - frames[0]!.facingAngle;
    expect(Math.abs(turned)).toBeCloseTo(Math.PI, 4);
    // And every step turns by the same amount, because every chord does.
    const steps = frames
      .map((frame, index, all) =>
        index === 0 ? null : frame.facingAngle - all[index - 1]!.facingAngle
      )
      .filter((value): value is number => value !== null);
    for (const step of steps) expect(step).toBeCloseTo(steps[0]!, 6);
  });

  it("measures speed along the arc, not across the chord", () => {
    // A 4m chord in 4s is 1 m/s and walkable; the semicircle over it is
    // 2*pi meters, 1.57 m/s, still walkable.
    expect(() =>
      compile([{ move: "walk", to: { x: 4, z: 0 }, along: { arc: "left" } }], {
        durationSeconds: 4,
      })
    ).not.toThrow();
    // Same chord in 2.5s is 1.6 m/s straight, but 2.51 m/s round the arc.
    expect(() =>
      compile([{ move: "walk", to: { x: 4, z: 0 }, along: { arc: "left" } }], {
        durationSeconds: 2.5,
      })
    ).not.toThrow();
    // 2.4s: 2.62 m/s round the arc, over the ceiling, while the chord is
    // only 1.67 m/s — proof the check reads the arc.
    expect(() =>
      compile([{ move: "walk", to: { x: 4, z: 0 }, along: { arc: "left" } }], {
        durationSeconds: 2.4,
      })
    ).toThrow(/Travel tops out at 2.6 m\/s/);
  });

  it("rejects an arc on a move that does not travel", () => {
    expect(() =>
      compile([{ move: "stand", along: { arc: "left" } }] as DirectorBlockingMove[])
    ).toThrow(/"stand" does not take a path/);
    expect(() =>
      compile([
        { move: "turn", direction: "left", along: { arc: "left" } },
      ] as DirectorBlockingMove[])
    ).toThrow(/"turn" does not take a path/);
  });

  it("arcs a relative walk as well as a walk to a mark", () => {
    const frames = compile([
      {
        move: "walk",
        direction: "forward",
        amount: { meters: 3 },
        along: { arc: "right" },
      },
    ]);
    expect(frames.filter((frame) => frame.walking).length).toBeGreaterThan(1);
  });
});
