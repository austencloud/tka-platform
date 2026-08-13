import { describe, expect, it } from "vitest";
import type { MotionData } from "../../../src/core/types/sequence-engine-types.js";
import {
  LOOPComponent,
  buildReflectedSoloLoop,
  buildRewoundSoloLoop,
  buildRotatedSoloLoop,
  detectSoloLOOP,
} from "../../../src/loop/index.js";

function motion(
  startLocation: MotionData["startLocation"],
  endLocation: MotionData["endLocation"],
  startOrientation: MotionData["startOrientation"],
  endOrientation: MotionData["endOrientation"],
  rotationDirection: MotionData["rotationDirection"] = "cw"
): MotionData {
  return {
    motionType: "pro",
    startLocation,
    endLocation,
    startOrientation,
    endOrientation,
    rotationDirection,
    turns: 1,
  };
}

describe("solo LOOP ownership", () => {
  it("closes any continuous seed as a rewound one-prop LOOP", () => {
    const loop = buildRewoundSoloLoop([
      motion("n", "e", "in", "out"),
      motion("e", "s", "out", "clock"),
    ]);

    expect(loop).toHaveLength(4);
    expect(loop[2]).toMatchObject({
      startLocation: "s",
      endLocation: "e",
      startOrientation: "clock",
      endOrientation: "out",
      rotationDirection: "ccw",
    });
    expect(loop[3]).toMatchObject({
      startLocation: "e",
      endLocation: "n",
      startOrientation: "out",
      endOrientation: "in",
    });

    const detected = detectSoloLOOP(loop);
    expect(detected.isLoop).toBe(true);
    expect(detected.spec?.components.has(LOOPComponent.REWOUND)).toBe(true);
  });

  it("rejects a closed path with no recognized LOOP structure", () => {
    const unstructured = [
      motion("n", "e", "in", "in"),
      motion("e", "s", "in", "in"),
      motion("s", "n", "in", "in"),
    ];

    expect(detectSoloLOOP(unstructured)).toMatchObject({
      isLoop: false,
      isContinuous: true,
      closesLocation: true,
      closesOrientation: true,
    });
  });

  it("builds and detects a quartered rotated one-prop LOOP", () => {
    const seed = [motion("n", "e", "in", "in", "cw")];
    seed[0] = { ...seed[0]!, turns: 0 };

    const loop = buildRotatedSoloLoop(seed, 4);
    const detected = detectSoloLOOP(loop);

    expect(loop.map((entry) => entry.startLocation)).toEqual([
      "n",
      "e",
      "s",
      "w",
    ]);
    expect(detected.isLoop).toBe(true);
    expect(detected.spec?.components.get(LOOPComponent.ROTATED)?.period).toBe(
      4
    );
  });

  it("builds and detects a mirrored one-prop LOOP", () => {
    const seed = [
      { ...motion("e", "n", "in", "in", "cw"), turns: 0 },
      {
        ...motion("n", "w", "in", "out", "cw"),
        motionType: "anti" as const,
        turns: 0,
      },
    ];

    const loop = buildReflectedSoloLoop(seed, LOOPComponent.MIRRORED);
    const detected = detectSoloLOOP(loop);

    expect(loop[2]).toMatchObject({
      startLocation: "w",
      endLocation: "n",
      rotationDirection: "ccw",
    });
    expect(detected.isLoop).toBe(true);
    expect(detected.spec?.components.has(LOOPComponent.MIRRORED)).toBe(true);
  });

  it("rejects a structurally rewound path when orientation continuity breaks", () => {
    const loop = buildRewoundSoloLoop([
      motion("n", "e", "in", "out"),
      motion("e", "s", "clock", "counter"),
    ]);

    expect(detectSoloLOOP(loop)).toMatchObject({
      isLoop: false,
      isContinuous: false,
    });
  });
});
