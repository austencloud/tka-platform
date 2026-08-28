import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { ClipBasedTurnAnimator } from "@austencloud/scene-3d";

describe("ClipBasedTurnAnimator", () => {
  it("samples source root yaw independently of the retargeted hips basis", () => {
    const animator = new ClipBasedTurnAnimator();
    animator.initializeFromData([
      {
        angleDeg: 90,
        clipName: "turn-left-90",
        duration: 1,
        frameCount: 3,
        boneFrames: new Map([
          [
            "Hips",
            [
              new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.7),
              new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.1),
              new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 1.4),
            ],
          ],
        ]),
        yawFrames: [0, 0.2, 0.8],
        hipsPositions: [],
        contactLeft: [1, 1, 1],
        contactRight: [1, 0, 1],
      },
    ]);

    const sample = animator.sample({
      fromHeading: 0,
      toHeading: Math.PI / 2,
      phase: 0.5,
    });

    expect(sample.yawDelta).toBeCloseTo(Math.PI / 8, 8);
    expect(sample.rightFootContact).toBe(0);
  });

  it("fails closed when authored coverage is required", () => {
    const animator = new ClipBasedTurnAnimator();
    animator.initializeFromData([]);

    const authored = animator.sample({
      fromHeading: 0,
      toHeading: Math.PI,
      phase: 0.5,
      requireAuthored: true,
    });
    const legacy = animator.sample({
      fromHeading: 0,
      toHeading: Math.PI,
      phase: 0.5,
    });

    expect(authored.clipName).toBe("");
    expect(authored.yawDelta).toBe(0);
    expect(legacy.yawDelta).toBeCloseTo(Math.PI / 2, 8);
  });

  it("keeps left and right turnaround clips distinct at the pi boundary", () => {
    const animator = new ClipBasedTurnAnimator();
    const clip = (angleDeg: number, clipName: string, terminalYaw: number) => ({
      angleDeg,
      clipName,
      duration: 1,
      frameCount: 2,
      boneFrames: new Map<string, Quaternion[]>(),
      yawFrames: [0, terminalYaw],
      hipsPositions: [new Vector3(), new Vector3()],
      contactLeft: [1, 0],
      contactRight: [0, 1],
    });
    animator.initializeFromData([
      clip(180, "turn-left-180", Math.PI),
      clip(-180, "turn-right-180", -Math.PI),
    ]);

    expect(
      animator.sample({ fromHeading: 0, toHeading: Math.PI, phase: 0.5 })
        .clipName
    ).toBe("turn-left-180");
    expect(
      animator.sample({ fromHeading: Math.PI, toHeading: 0, phase: 0.5 })
        .clipName
    ).toBe("turn-right-180");
  });
});
