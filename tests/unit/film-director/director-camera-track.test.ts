import { describe, expect, it } from "vitest";

import {
  getPreviewCameraFov,
  resolveDirectorCameraTrack,
  sampleDirectorCameraTrack,
} from "../../../src/routes/test/film-director/_lib/director-camera-track";
import type { ResolvedDirectorCameraKeyframe } from "../../../src/routes/test/film-director/_lib/film-director-schema";

const CONTEXT = {
  durationSeconds: 8,
  aspectRatio: 16 / 9,
  groundOffset: 0,
  sceneId: "test-scene",
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
  formation: "line" as const,
};

const frames: ResolvedDirectorCameraKeyframe[] = [
  {
    atSeconds: 0,
    position: [0, 1, -8],
    target: [0, 0, 0],
    fovDeg: 54,
    interpolation: "linear",
    easing: "linear",
  },
  {
    atSeconds: 4,
    position: [4, 2, -4],
    target: [0, 0.5, 0],
    fovDeg: 46,
    interpolation: "linear",
    easing: "linear",
  },
];

/** Factory for a resolved keyframe with sensible defaults, so rollDeg-focused
 * tests only spell out the fields they care about. */
function kf(
  overrides: Partial<ResolvedDirectorCameraKeyframe> & { atSeconds: number }
): ResolvedDirectorCameraKeyframe {
  return {
    position: [0, 1, -8],
    target: [0, 0, 0],
    fovDeg: 50,
    interpolation: "linear",
    easing: "linear",
    ...overrides,
  };
}

describe("director camera sampling", () => {
  it("interpolates position, target, and lens on the same clock", () => {
    expect(sampleDirectorCameraTrack(frames, 2)).toEqual({
      position: [2, 1.5, -6],
      target: [0, 0.25, 0],
      fovDeg: 50,
      rollDeg: 0,
    });
  });

  it("holds a step segment until the next keyframe", () => {
    const held = [
      { ...frames[0]!, interpolation: "step" as const },
      frames[1]!,
    ];
    expect(sampleDirectorCameraTrack(held, 3.9)).toEqual({
      position: [0, 1, -8],
      target: [0, 0, 0],
      fovDeg: 54,
      rollDeg: 0,
    });
  });

  it("widens only a portrait preview while preserving the authored film lens", () => {
    expect(getPreviewCameraFov(50, 16 / 9, 16 / 9)).toBe(50);
    expect(getPreviewCameraFov(50, 16 / 9, 9 / 16)).toBe(82);
    expect(getPreviewCameraFov(50, 16 / 9, 21 / 9)).toBe(50);
  });
});

describe("director camera grammar resolution", () => {
  it("compiles framing + moves into a keyframe track", () => {
    const track = resolveDirectorCameraTrack(
      {
        subject: { kind: "group" },
        shotSize: "wide",
        angle: "low",
        moves: [
          { move: "hold", durationSeconds: 2 },
          { move: "orbit", direction: "ccw", amount: { degrees: 90 } },
        ],
      },
      CONTEXT
    );
    expect(track.preset).toBe("custom");
    expect(track.keyframes[0]!.atSeconds).toBe(0);
    expect(track.keyframes.at(-1)!.atSeconds).toBeCloseTo(
      CONTEXT.durationSeconds,
      5
    );
  });

  it("rejects mixing keyframes with framing grammar", () => {
    expect(() =>
      resolveDirectorCameraTrack(
        {
          shotSize: "wide",
          keyframes: [{ atSeconds: 0, position: [0, 1, -4] }],
        },
        CONTEXT
      )
    ).toThrow(/keyframes/i);
  });

  it("rejects mixing a preset with framing grammar", () => {
    expect(() =>
      resolveDirectorCameraTrack(
        { preset: "group-orbit", shotSize: "close-up" },
        CONTEXT
      )
    ).toThrow(/preset/i);
  });

  it("carries an authored rollDeg through raw keyframe resolution", () => {
    const track = resolveDirectorCameraTrack(
      {
        keyframes: [
          { atSeconds: 0, position: [0, 1, -4], rollDeg: 12 },
          { atSeconds: 4, position: [0, 1, -4] },
        ],
      },
      CONTEXT
    );
    expect(track.keyframes[0]!.rollDeg).toBe(12);
    expect(track.keyframes[1]!.rollDeg).toBeUndefined();
  });
});

describe("rollDeg sampling", () => {
  it("interpolates roll between keyframes and defaults absent roll to 0", () => {
    const rollFrames = [
      kf({ atSeconds: 0, rollDeg: 0, interpolation: "linear" }),
      kf({ atSeconds: 4, rollDeg: 10, interpolation: "linear" }),
    ];
    expect(sampleDirectorCameraTrack(rollFrames, 2).rollDeg).toBeCloseTo(5, 4);
    expect(sampleDirectorCameraTrack(rollFrames, 0).rollDeg).toBe(0);
    expect(sampleDirectorCameraTrack(rollFrames, 99).rollDeg).toBe(10);
  });

  it("legacy keyframes without rollDeg sample as 0", () => {
    const legacyFrames = [kf({ atSeconds: 0 }), kf({ atSeconds: 4 })];
    expect(sampleDirectorCameraTrack(legacyFrames, 2).rollDeg).toBe(0);
  });

  it("a held fov or roll stays exactly held under smooth interpolation", () => {
    // Catmull-Rom bows a flat segment toward its neighbours unless the sampler
    // short-circuits it: fov crept to 50.2 before a zoom, roll dipped below 0
    // before a clockwise roll. A hold is a hold.
    const frames = [
      kf({ atSeconds: 0, fovDeg: 50, rollDeg: 0, interpolation: "smooth" }),
      kf({ atSeconds: 4, fovDeg: 50, rollDeg: 0, interpolation: "smooth" }),
      kf({ atSeconds: 8, fovDeg: 35, rollDeg: 0, interpolation: "smooth" }),
      kf({ atSeconds: 10, fovDeg: 35, rollDeg: 10, interpolation: "smooth" }),
    ];
    for (const t of [0.5, 1.2, 2, 3.7]) {
      expect(sampleDirectorCameraTrack(frames, t).fovDeg).toBe(50);
    }
    for (const t of [1, 4.5, 6.7, 7.9]) {
      expect(sampleDirectorCameraTrack(frames, t).rollDeg).toBe(0);
    }
    // The moving segments still ease rather than step.
    const midZoom = sampleDirectorCameraTrack(frames, 6).fovDeg;
    expect(midZoom).toBeGreaterThan(35);
    expect(midZoom).toBeLessThan(50);
  });
});

describe("camera tracking resolution", () => {
  const grammar = (track?: true | "follow") => ({
    subject: {
      kind: "performer" as const,
      performerId: "performer-2",
      ...(track ? { track } : {}),
    },
    shotSize: "medium" as const,
    moves: [{ move: "hold" as const }],
  });

  it("carries an aim request into the resolved track", () => {
    expect(resolveDirectorCameraTrack(grammar(true), CONTEXT).tracking).toEqual({
      performerId: "performer-2",
      mode: "aim",
    });
  });

  it("carries a follow request into the resolved track", () => {
    expect(
      resolveDirectorCameraTrack(grammar("follow"), CONTEXT).tracking
    ).toEqual({ performerId: "performer-2", mode: "follow" });
  });

  it("leaves the key absent when nothing asked to be tracked", () => {
    const resolved = resolveDirectorCameraTrack(grammar(), CONTEXT);
    expect("tracking" in resolved).toBe(false);
  });
});

describe("camera shots resolution and sampling", () => {
  const shotsInput = {
    shots: [
      { subject: { kind: "group" as const }, shotSize: "wide" as const },
      {
        subject: { kind: "performer" as const, performerId: "performer-1" },
        shotSize: "close-up" as const,
        moves: [{ move: "push-in" as const, amount: { meters: 0.4 } }],
      },
      {
        subject: { kind: "group" as const },
        shotSize: "medium" as const,
        position: "behind" as const,
      },
    ],
  };
  const context12 = { ...CONTEXT, durationSeconds: 12 };

  it("resolves shots to one custom track", () => {
    const resolved = resolveDirectorCameraTrack(shotsInput, context12);
    expect(resolved.preset).toBe("custom");
    expect(resolved.substitutedFor).toBeNull();
    expect("tracking" in resolved).toBe(false);
  });

  it("holds the outgoing framing right up to the cut, then jumps", () => {
    const { keyframes } = resolveDirectorCameraTrack(shotsInput, context12);
    const shotOneEnd = keyframes.find(
      (frame) => Math.abs(frame.atSeconds - 4) < 1e-6
    )!;
    const before = sampleDirectorCameraTrack(keyframes, 3.999);
    const after = sampleDirectorCameraTrack(keyframes, 4);
    expect(before.position).toEqual(shotOneEnd.position);
    expect(
      Math.hypot(
        after.position[0] - before.position[0],
        after.position[1] - before.position[1],
        after.position[2] - before.position[2]
      )
    ).toBeGreaterThan(1);
  });

  it("does not bend the incoming shot's spline toward the outgoing one", () => {
    const { keyframes } = resolveDirectorCameraTrack(shotsInput, context12);
    const shotTwo = keyframes.filter(
      (frame) => frame.atSeconds >= 4 - 1e-6 && frame.atSeconds <= 8 + 1e-6
    );
    // Both cut instants carry two frames; shot two owns the inner pair.
    const from = shotTwo.at(1)!.position;
    const to = shotTwo.at(-2)!.position;
    const sampled = sampleDirectorCameraTrack(keyframes, 4.5).position;
    // On the straight segment: one shared parameter t across all three axes.
    // Read t off the axis that actually travels — a near-degenerate axis
    // divides float noise by float noise.
    const widest = [0, 1, 2].reduce((best, axis) =>
      Math.abs(to[axis]! - from[axis]!) > Math.abs(to[best]! - from[best]!)
        ? axis
        : best
    );
    const t = (sampled[widest]! - from[widest]!) / (to[widest]! - from[widest]!);
    for (const axis of [0, 1, 2]) {
      expect(sampled[axis]).toBeCloseTo(
        from[axis]! + (to[axis]! - from[axis]!) * t,
        6
      );
    }
  });

  it("rejects tracking inside a shot", () => {
    expect(() =>
      resolveDirectorCameraTrack(
        {
          shots: [
            {
              subject: {
                kind: "performer" as const,
                performerId: "performer-1",
                track: "follow" as const,
              },
              shotSize: "medium" as const,
            },
            { subject: { kind: "group" as const } },
          ],
        },
        context12
      )
    ).toThrow(/Tracking and shots do not combine/);
  });
});
