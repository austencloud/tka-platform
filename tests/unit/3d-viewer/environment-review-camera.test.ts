import { describe, expect, it } from "vitest";
import { CAMERA_DEFAULTS } from "@austencloud/camera-3d";
import { resolveEnvironmentReviewWalkPose } from "$lib/shared/3d/environments/review/environment-review-camera";

describe("environment review walk camera", () => {
  it("preserves the approved eye position when switching from a fixed shot", () => {
    const preset = {
      position: [0, 2.1, 7] as const,
      target: [0, 1.3, 0] as const,
      fov: 58,
    };

    const pose = resolveEnvironmentReviewWalkPose(preset);

    expect(
      pose.playerPosition.y + CAMERA_DEFAULTS.FIRST_PERSON_CAMERA_OFFSET
    ).toBeCloseTo(preset.position[1], 8);
    expect(pose.playerPosition.x).toBe(preset.position[0]);
    expect(pose.playerPosition.z).toBe(preset.position[2]);
  });

  it("faces the fixed shot target without an initial camera jump", () => {
    const pose = resolveEnvironmentReviewWalkPose({
      position: [0, 2.1, 7],
      target: [0, 1.3, 0],
      fov: 58,
    });

    expect(pose.yaw).toBeCloseTo(Math.PI, 8);
    expect(pose.pitch).toBeGreaterThan(0);
    expect(pose.pitch).toBeLessThan(0.2);
  });

  it("keeps a zero-length review direction finite", () => {
    const pose = resolveEnvironmentReviewWalkPose({
      position: [2, 3, 4],
      target: [2, 3, 4],
      fov: 58,
    });

    expect(pose.yaw).toBe(0);
    expect(pose.pitch).toBe(0);
  });
});
