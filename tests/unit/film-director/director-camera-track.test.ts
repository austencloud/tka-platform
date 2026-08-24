import { describe, expect, it } from "vitest";

import {
  getPreviewCameraFov,
  sampleDirectorCameraTrack,
} from "../../../src/routes/test/film-director/_lib/director-camera-track";
import type { ResolvedDirectorCameraKeyframe } from "../../../src/routes/test/film-director/_lib/film-director-schema";

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
