import { userProportionsState } from "@austencloud/scene-3d";
import { describe, expect, it } from "vitest";

import {
  compileCameraMoves,
  compileCameraShots,
  computeCameraFraming,
  directorFloorY,
} from "../../../src/routes/test/film-director/_lib/camera-language";

type V3 = [number, number, number];

const CONTEXT = {
  durationSeconds: 8,
  aspectRatio: 16 / 9,
  groundOffset: 0,
  performers: [
    {
      id: "performer-1", name: "P1", characterId: "y-bot" as never,
      prop: "staff" as never, effect: "none" as never, effort: "linear" as never,
      position: { x: -1, z: 0 }, facingAngle: 0, blocking: [], beatOffset: 0, staffLengthCm: null,
    },
    {
      id: "performer-2", name: "P2", characterId: "x-bot" as never,
      prop: "staff" as never, effect: "none" as never, effort: "linear" as never,
      position: { x: 1, z: 0 }, facingAngle: 0, blocking: [], beatOffset: 0, staffLengthCm: null,
    },
  ],
};

/** CONTEXT with overrides — the new truck/zoom/roll suites need a shorter
 * duration than the shared CONTEXT so each move's window is easy to reason
 * about, without disturbing the fixture every existing test in this file reads. */
function context(overrides: Partial<typeof CONTEXT> = {}) {
  return { ...CONTEXT, ...overrides };
}

/** A plain CameraFraming fixture for zoom/roll tests, where the exact position
 * doesn't matter — only that it stays fixed (zoom) or unrotated (roll). */
const framing50: { position: V3; target: V3; fovDeg: number } = {
  position: [0, 1.6, 6],
  target: [0, 1.2, 0],
  fovDeg: 50,
};

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

describe("computeCameraFraming", () => {
  it("close-up is nearer than wide, which is nearer than extreme-wide", () => {
    const closeUp = computeCameraFraming({ shotSize: "close-up" }, CONTEXT);
    const wide = computeCameraFraming({ shotSize: "wide" }, CONTEXT);
    const extreme = computeCameraFraming({ shotSize: "extreme-wide" }, CONTEXT);
    expect(distance(closeUp.position, closeUp.target)).toBeLessThan(
      distance(wide.position, wide.target)
    );
    expect(distance(wide.position, wide.target)).toBeLessThan(
      distance(extreme.position, extreme.target)
    );
  });

  it("a performer subject targets that performer's position", () => {
    const framing = computeCameraFraming(
      { subject: { kind: "performer", performerId: "performer-2" } },
      CONTEXT
    );
    expect(framing.target[0]).toBeCloseTo(1, 5);
  });

  it("low angle puts the camera below eye target height; top well above", () => {
    const low = computeCameraFraming({ angle: "low" }, CONTEXT);
    const top = computeCameraFraming({ angle: "top" }, CONTEXT);
    expect(low.position[1]).toBeLessThan(low.target[1]);
    expect(top.position[1]).toBeGreaterThan(top.target[1] + 2);
  });

  it("left and behind vantages sit on opposite sides from right and front", () => {
    const front = computeCameraFraming({ position: "front" }, CONTEXT);
    const behind = computeCameraFraming({ position: "behind" }, CONTEXT);
    const left = computeCameraFraming({ position: "left" }, CONTEXT);
    const right = computeCameraFraming({ position: "right" }, CONTEXT);
    expect(Math.sign(front.position[2] - front.target[2])).not.toBe(
      Math.sign(behind.position[2] - behind.target[2])
    );
    expect(Math.sign(left.position[0] - left.target[0])).not.toBe(
      Math.sign(right.position[0] - right.target[0])
    );
  });

  it("close-up performer targets sit near head height, not above it", () => {
    // Regression: the target was once computed as groundOffset + 1.45, but
    // groundOffset is the rig ORIGIN (shoulder height) — feet sit
    // userProportionsState.groundY below it. That aimed close-ups ~1.5m over
    // every head and framed empty air (Understudy Night scene 1).
    const framing = computeCameraFraming(
      {
        subject: { kind: "performer", performerId: "performer-1" },
        shotSize: "close-up",
      },
      CONTEXT
    );
    const floorY = directorFloorY(CONTEXT.groundOffset);
    expect(framing.target[1]).toBeCloseTo(floorY + 1.45, 5);
    // Sanity: the floor really is below the rig origin, so an absolute-height
    // reading would have produced a strictly higher target.
    expect(userProportionsState.groundY).toBeLessThan(0);
    expect(framing.target[1]).toBeLessThan(CONTEXT.groundOffset + 1.45);
  });

  it("an explicit subject height is measured from the performer's floor", () => {
    const framing = computeCameraFraming(
      {
        subject: { kind: "performer", performerId: "performer-2", height: 1.35 },
      },
      CONTEXT
    );
    expect(framing.target[1]).toBeCloseTo(
      directorFloorY(CONTEXT.groundOffset) + 1.35,
      5
    );
  });

  it("rejects an unknown subject performer", () => {
    expect(() =>
      computeCameraFraming(
        { subject: { kind: "performer", performerId: "ghost" } },
        CONTEXT
      )
    ).toThrow(/ghost/);
  });
});

describe("compileCameraMoves", () => {
  const framing = computeCameraFraming({ shotSize: "wide" }, CONTEXT);

  it("hold emits a step keyframe pair covering its window", () => {
    const frames = compileCameraMoves([{ move: "hold" }], framing, CONTEXT);
    expect(frames[0]!.atSeconds).toBe(0);
    expect(frames.at(-1)!.atSeconds).toBeCloseTo(CONTEXT.durationSeconds, 5);
  });

  it("push-in ends closer to the target; pull-back ends farther", () => {
    const push = compileCameraMoves(
      [{ move: "push-in", amount: { meters: 2 } }],
      framing,
      CONTEXT
    );
    const pull = compileCameraMoves(
      [{ move: "pull-back", amount: { meters: 2 } }],
      framing,
      CONTEXT
    );
    const dist = (frame: (typeof push)[number]) =>
      Math.hypot(
        frame.position[0] - frame.target[0],
        frame.position[1] - frame.target[1],
        frame.position[2] - frame.target[2]
      );
    expect(dist(push.at(-1)!)).toBeLessThan(dist(push[0]!));
    expect(dist(pull.at(-1)!)).toBeGreaterThan(dist(pull[0]!));
  });

  it("orbit sweeps the requested angle around the target", () => {
    const frames = compileCameraMoves(
      [{ move: "orbit", direction: "ccw", amount: { degrees: 90 } }],
      framing,
      CONTEXT
    );
    const angle = (frame: (typeof frames)[number]) =>
      Math.atan2(
        frame.position[0] - frame.target[0],
        frame.position[2] - frame.target[2]
      );
    // The front camera sits at -z, so the raw atan2 difference can wrap past
    // ±π; measure the shorter way round.
    const raw = Math.abs(angle(frames.at(-1)!) - angle(frames[0]!)) % (2 * Math.PI);
    const sweep = Math.min(raw, 2 * Math.PI - raw);
    expect(sweep).toBeCloseTo(Math.PI / 2, 1);
  });

  it("cw from the front ends on the performers' screen-left side (Austen's felt convention, 2026-09-02)", () => {
    // The front camera sits at -z looking toward +z, so its screen-left is +x.
    const cw = compileCameraMoves(
      [{ move: "orbit", direction: "cw", amount: { degrees: 90 } }],
      framing,
      CONTEXT
    );
    const ccw = compileCameraMoves(
      [{ move: "orbit", direction: "ccw", amount: { degrees: 90 } }],
      framing,
      CONTEXT
    );
    expect(cw[0]!.position[2]).toBeLessThan(cw[0]!.target[2]);
    expect(cw.at(-1)!.position[0]).toBeGreaterThan(cw.at(-1)!.target[0]);
    expect(ccw.at(-1)!.position[0]).toBeLessThan(ccw.at(-1)!.target[0]);
  });

  it("moves chain: explicit durations consume time, the rest split evenly", () => {
    const frames = compileCameraMoves(
      [
        { move: "hold", durationSeconds: 2 },
        { move: "push-in" },
        { move: "orbit", direction: "cw", amount: { degrees: 45 } },
      ],
      framing,
      CONTEXT
    );
    expect(frames.at(-1)!.atSeconds).toBeCloseTo(8, 5);
  });

  it("rejects contradictions", () => {
    expect(() =>
      compileCameraMoves(
        [{ move: "orbit", direction: "up", amount: { degrees: 90 } }],
        framing,
        CONTEXT
      )
    ).toThrow(/orbit/i);
    expect(() =>
      compileCameraMoves(
        [{ move: "push-in", amount: { degrees: 30 } }],
        framing,
        CONTEXT
      )
    ).toThrow(/meters/i);
    expect(() =>
      compileCameraMoves(
        [
          { move: "hold", durationSeconds: 6 },
          { move: "push-in", durationSeconds: 6 },
        ],
        framing,
        CONTEXT
      )
    ).toThrow(/duration/i);
  });

  it("an empty moves array returns a two-frame hold spanning the scene", () => {
    const frames = compileCameraMoves([], framing, CONTEXT);
    expect(frames).toHaveLength(2);
    expect(frames[0]!.atSeconds).toBe(0);
    expect(frames[0]!.interpolation).toBe("step");
    expect(frames[1]!.atSeconds).toBeCloseTo(CONTEXT.durationSeconds, 5);
    expect(frames[1]!.interpolation).toBe("step");
    expect(frames[0]!.position).toEqual(framing.position);
    expect(frames[0]!.target).toEqual(framing.target);
  });
});

describe("truck", () => {
  it("translates position and target together along camera-right", () => {
    // Assert the invariants rather than a hand-derived world vector.
    const frames = compileCameraMoves(
      [{ move: "truck", direction: "right", amount: { meters: 2 } }],
      framing50,
      context({ durationSeconds: 4 })
    );
    const first = frames[0]!;
    const last = frames.at(-1)!;
    // Both endpoints moved by the same vector (no rotation of the framing):
    const dPos = sub(last.position, first.position);
    const dTgt = sub(last.target, first.target);
    expect(dPos).toEqual(dTgt);
    // The move is 2 meters, on the ground plane, perpendicular to view:
    expect(Math.hypot(...dPos)).toBeCloseTo(2, 6);
    expect(dPos[1]).toBeCloseTo(0, 6);
    const forward = sub(first.target, first.position);
    expect(dPos[0] * forward[0] + dPos[2] * forward[2]).toBeCloseTo(0, 6);
  });

  it("left and right are opposite vectors", () => {
    const right = compileCameraMoves(
      [{ move: "truck", direction: "right", amount: { meters: 2 } }],
      framing50,
      context({ durationSeconds: 4 })
    );
    const left = compileCameraMoves(
      [{ move: "truck", direction: "left", amount: { meters: 2 } }],
      framing50,
      context({ durationSeconds: 4 })
    );
    const dRight = sub(right.at(-1)!.position, right[0]!.position);
    const dLeft = sub(left.at(-1)!.position, left[0]!.position);
    expect(dLeft[0]).toBeCloseTo(-dRight[0], 6);
    expect(dLeft[1]).toBeCloseTo(-dRight[1], 6);
    expect(dLeft[2]).toBeCloseTo(-dRight[2], 6);
  });

  it("rejects a truck from a framing that looks straight down", () => {
    const overhead = {
      ...framing50,
      position: [framing50.target[0], framing50.target[1] + 5, framing50.target[2]] as V3,
    };
    expect(() =>
      compileCameraMoves(
        [{ move: "truck", direction: "right", amount: { meters: 1 } }],
        overhead,
        context({ durationSeconds: 4 })
      )
    ).toThrow(/has no sideways/);
  });

  it("an old move rejects the new lens directions", () => {
    expect(() =>
      compileCameraMoves(
        [{ move: "pan", direction: "in" as never }],
        framing50,
        context({ durationSeconds: 4 })
      )
    ).toThrow(/direction must be one of/);
  });
});

describe("zoom", () => {
  it("zoom in narrows fov by the stated degrees without moving the camera", () => {
    const frames = compileCameraMoves(
      [{ move: "zoom", direction: "in", amount: { degrees: 15 } }],
      framing50,
      context({ durationSeconds: 4 })
    );
    expect(frames[0]!.fovDeg).toBe(50);
    expect(frames.at(-1)!.fovDeg).toBe(35);
    expect(frames.at(-1)!.position).toEqual(frames[0]!.position);
  });

  it("a later push-in starts from the zoomed fov", () => {
    const frames = compileCameraMoves(
      [
        { move: "zoom", direction: "in", amount: { degrees: 15 } },
        { move: "push-in", amount: { meters: 1 } },
      ],
      framing50,
      context({ durationSeconds: 4 })
    );
    expect(frames[0]!.fovDeg).toBe(50);
    for (const frame of frames.slice(1)) {
      expect(frame.fovDeg).toBe(35);
    }
  });

  it("rejects a zoom that leaves 20-100", () => {
    expect(() =>
      compileCameraMoves(
        [{ move: "zoom", direction: "in", amount: { degrees: 40 } }],
        framing50,
        context({ durationSeconds: 4 })
      )
    ).toThrow(/outside the 20-100 degree range/);
  });

  it("accepts a zoom that lands exactly on the 20 and 100 degree edges", () => {
    const tight = compileCameraMoves(
      [{ move: "zoom", direction: "in", amount: { degrees: 30 } }],
      framing50,
      context({ durationSeconds: 4 })
    );
    expect(tight.at(-1)!.fovDeg).toBe(20);
    const wide = compileCameraMoves(
      [{ move: "zoom", direction: "out", amount: { degrees: 50 } }],
      framing50,
      context({ durationSeconds: 4 })
    );
    expect(wide.at(-1)!.fovDeg).toBe(100);
  });
});

describe("roll", () => {
  it("ramps rollDeg from an explicit 0 anchor to the signed amount", () => {
    const frames = compileCameraMoves(
      [{ move: "roll", direction: "cw", amount: { degrees: 10 } }],
      framing50,
      context({ durationSeconds: 4 })
    );
    expect(frames[0]!.rollDeg).toBe(0);
    expect(frames.at(-1)!.rollDeg).toBe(10);
  });

  it("ccw is negative and rolls accumulate", () => {
    const frames = compileCameraMoves(
      [
        { move: "roll", direction: "cw", amount: { degrees: 10 } },
        { move: "roll", direction: "ccw", amount: { degrees: 25 } },
      ],
      framing50,
      context({ durationSeconds: 4 })
    );
    expect(frames[0]!.rollDeg).toBe(0);
    expect(frames.at(-1)!.rollDeg).toBe(-15);
  });

  it("keyframes from scenes that never roll carry no rollDeg key", () => {
    const frames = compileCameraMoves([{ move: "hold" }], framing50, context({ durationSeconds: 4 }));
    for (const frame of frames) expect("rollDeg" in frame).toBe(false);
  });
});

describe("compileCameraShots", () => {
  const wide = { subject: { kind: "group" as const }, shotSize: "wide" as const };
  const closeUp = {
    subject: { kind: "performer" as const, performerId: "performer-1" },
    shotSize: "close-up" as const,
  };
  const behind = {
    subject: { kind: "group" as const },
    shotSize: "medium" as const,
    position: "behind" as const,
  };

  it("splits an unstated scene evenly and never runs time backwards", () => {
    const frames = compileCameraShots(
      [wide, closeUp, behind],
      context({ durationSeconds: 12 })
    );
    expect(frames[0]!.atSeconds).toBe(0);
    expect(frames.at(-1)!.atSeconds).toBeCloseTo(12, 6);
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i]!.atSeconds).toBeGreaterThanOrEqual(frames[i - 1]!.atSeconds);
    }
    expect(frames.filter((frame) => Math.abs(frame.atSeconds - 4) < 1e-6)).toHaveLength(2);
    expect(frames.filter((frame) => Math.abs(frame.atSeconds - 8) < 1e-6)).toHaveLength(2);
  });

  it("steps out of every shot but the last, at the instant the next begins", () => {
    const frames = compileCameraShots(
      [wide, closeUp, behind],
      context({ durationSeconds: 12 })
    );
    const atCut = frames.filter((frame) => Math.abs(frame.atSeconds - 4) < 1e-6);
    expect(atCut[0]!.interpolation).toBe("step");
    // The incoming shot's framing is a different place entirely — the cut.
    expect(distance(atCut[1]!.position, atCut[0]!.position)).toBeGreaterThan(1);
    const last = frames.at(-1)!;
    const secondLast = frames.at(-2)!;
    // The final shot keeps whatever compileCameraMoves gave it (a hold's step),
    // not a forced barrier: nothing follows it to cut to.
    expect(last.interpolation).toBe(secondLast.interpolation);
  });

  it("honors stated durations and leaves the rest to the open shots", () => {
    const frames = compileCameraShots(
      [
        { ...wide, durationSeconds: 2 },
        closeUp,
        { ...behind, durationSeconds: 4 },
      ],
      context({ durationSeconds: 12 })
    );
    const cuts = frames
      .map((frame) => frame.atSeconds)
      .filter((at, index, all) => all.indexOf(at) !== index);
    expect(cuts).toEqual([2, 8]);
  });

  it("rejects shots that ask for more time than the scene has", () => {
    expect(() =>
      compileCameraShots(
        [
          { ...wide, durationSeconds: 10 },
          { ...closeUp, durationSeconds: 10 },
        ],
        context({ durationSeconds: 16 })
      )
    ).toThrow(/Camera shots total/);
  });
});

describe("compileCameraMoves: concurrent moves (with)", () => {
  it("a dolly zoom holds the subject the same size at every keyframe", () => {
    const frames = compileCameraMoves(
      [
        {
          move: "push-in",
          amount: { meters: 1.5 },
          durationSeconds: 8,
          with: [{ move: "zoom", amount: { match: "subject-size" } }],
        },
      ],
      framing50,
      context({ durationSeconds: 8 })
    );
    const size = (frame: (typeof frames)[number]) =>
      Math.tan((frame.fovDeg * Math.PI) / 360) * distance(frame.position, frame.target);
    const opening = size(frames[0]!);
    for (const frame of frames) {
      expect(Math.abs(size(frame) - opening) / opening).toBeLessThan(0.01);
    }
    // It really did travel, and the lens really did answer.
    expect(distance(frames.at(-1)!.position, frames.at(-1)!.target)).toBeLessThan(
      distance(frames[0]!.position, frames[0]!.target) - 1
    );
    expect(frames.at(-1)!.fovDeg).toBeGreaterThan(frames[0]!.fovDeg + 5);
  });

  it("a truck riding with a crane ends diagonally, both deltas applied", () => {
    const solo = (move: Parameters<typeof compileCameraMoves>[0][number]) =>
      compileCameraMoves([move], framing50, context({ durationSeconds: 4 })).at(-1)!;
    const truck = solo({
      move: "truck",
      direction: "right",
      amount: { meters: 2 },
      durationSeconds: 4,
    });
    const crane = solo({
      move: "crane",
      direction: "up",
      amount: { meters: 1 },
      durationSeconds: 4,
    });
    const both = solo({
      move: "truck",
      direction: "right",
      amount: { meters: 2 },
      durationSeconds: 4,
      with: [{ move: "crane", direction: "up", amount: { meters: 1 } }],
    });
    expect(both.position[0]).toBeCloseTo(truck.position[0], 6);
    expect(both.position[1]).toBeCloseTo(crane.position[1], 6);
    expect(both.position[2]).toBeCloseTo(truck.position[2], 6);
  });

  it("an orbit riding with a zoom keeps its segments and interpolates the lens", () => {
    const frames = compileCameraMoves(
      [
        {
          move: "orbit",
          direction: "cw",
          amount: { degrees: 90 },
          durationSeconds: 6,
          with: [{ move: "zoom", direction: "in", amount: { degrees: 10 } }],
        },
      ],
      framing50,
      context({ durationSeconds: 6 })
    );
    // 90 degrees at 30 per segment is 3 samples plus the opening frame.
    expect(frames).toHaveLength(4);
    expect(frames.at(-1)!.fovDeg).toBeCloseTo(40, 6);
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index]!.fovDeg).toBeLessThan(frames[index - 1]!.fovDeg);
      // The orbit radius survives the zoom riding alongside it.
      expect(distance(frames[index]!.position, frames[index]!.target)).toBeCloseTo(
        distance(frames[0]!.position, frames[0]!.target),
        6
      );
    }
  });

  it("rejects a group whose combined lens leaves the usable range", () => {
    expect(() =>
      compileCameraMoves(
        [
          {
            move: "push-in",
            amount: { meters: 5.5 },
            durationSeconds: 4,
            with: [{ move: "zoom", amount: { match: "subject-size" } }],
          },
        ],
        framing50,
        context({ durationSeconds: 4 })
      )
    ).toThrow(/outside the 20-100 degree range/);
  });
});

describe("compileCameraMoves: pan to a destination", () => {
  it("ends aimed at the named performer", () => {
    const frames = compileCameraMoves(
      [
        {
          move: "pan",
          to: { kind: "performer", performerId: "performer-2" },
          durationSeconds: 4,
        },
      ],
      { position: [0, 1.6, 6], target: [-1, 1.2, 0], fovDeg: 50 },
      context({ durationSeconds: 4 })
    );
    const last = frames.at(-1)!;
    const aim = Math.atan2(last.target[0] - last.position[0], last.target[2] - last.position[2]);
    const want = Math.atan2(1 - last.position[0], 0 - last.position[2]);
    expect(aim).toBeCloseTo(want, 6);
    // A pan turns in place: the rig never moved.
    expect(last.position).toEqual([0, 1.6, 6]);
  });

  it("ends aimed at a stated point", () => {
    const frames = compileCameraMoves(
      [
        {
          move: "pan",
          to: { kind: "point", position: [3, 1.2, 1] },
          durationSeconds: 4,
        },
      ],
      framing50,
      context({ durationSeconds: 4 })
    );
    const last = frames.at(-1)!;
    const aim = Math.atan2(last.target[0] - last.position[0], last.target[2] - last.position[2]);
    const want = Math.atan2(3 - last.position[0], 1 - last.position[2]);
    expect(aim).toBeCloseTo(want, 6);
  });

  it("names the performer it cannot find", () => {
    expect(() =>
      compileCameraMoves(
        [{ move: "pan", to: { kind: "performer", performerId: "ghost" } }],
        framing50,
        context({ durationSeconds: 4 })
      )
    ).toThrow(/missing performer "ghost"/);
  });
});
