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
      id: "performer-1", name: "P1", avatarId: "y-bot" as never,
      prop: "staff" as never, effect: "none" as never, effort: "linear" as never,
      position: { x: -1, z: 0 }, facingAngle: 0, blocking: [], beatOffset: 0, staffLengthCm: null,
    },
    {
      id: "performer-2", name: "P2", avatarId: "x-bot" as never,
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
});
