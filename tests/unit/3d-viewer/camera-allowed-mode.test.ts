import { describe, expect, it } from "vitest";
import { CameraMode, resolveAllowedCameraMode } from "@austencloud/camera-3d";

describe("camera allowed-mode resolution", () => {
  it("keeps a supported preference", () => {
    expect(
      resolveAllowedCameraMode(CameraMode.FIRST_PERSON, [
        CameraMode.FIRST_PERSON,
      ])
    ).toBe(CameraMode.FIRST_PERSON);
  });

  it("clamps a stale preference to the destination's first supported mode", () => {
    expect(
      resolveAllowedCameraMode(CameraMode.ORBIT, [CameraMode.FIRST_PERSON])
    ).toBe(CameraMode.FIRST_PERSON);
  });

  it("preserves the preference when a destination has no restriction", () => {
    expect(resolveAllowedCameraMode(CameraMode.THIRD_PERSON)).toBe(
      CameraMode.THIRD_PERSON
    );
  });
});
