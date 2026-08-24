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
  performers: [
    {
      id: "performer-1", name: "P1", avatarId: "y-bot" as never,
      prop: "staff" as never, effect: "none" as never, effort: "linear" as never,
      position: { x: -1, z: 0 }, facingAngle: 0, beatOffset: 0, staffLengthCm: null,
    },
    {
      id: "performer-2", name: "P2", avatarId: "x-bot" as never,
      prop: "staff" as never, effect: "none" as never, effort: "linear" as never,
      position: { x: 1, z: 0 }, facingAngle: 0, beatOffset: 0, staffLengthCm: null,
    },
  ],
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

describe("director camera sampling", () => {
  it("interpolates position, target, and lens on the same clock", () => {
    expect(sampleDirectorCameraTrack(frames, 2)).toEqual({
      position: [2, 1.5, -6],
      target: [0, 0.25, 0],
      fovDeg: 50,
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
    const frames = resolveDirectorCameraTrack(
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
    expect(frames[0]!.atSeconds).toBe(0);
    expect(frames.at(-1)!.atSeconds).toBeCloseTo(CONTEXT.durationSeconds, 5);
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
});
