import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  Plane,
  PropType,
  propFinishState,
  type PropState3D,
} from "@austencloud/scene-3d";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import {
  WorkerImperativeEffectFrameBuilder,
  type WorkerImperativeEffectFrameInput,
} from "$lib/shared/3d/worker-renderer/effects/worker-imperative-effect-frame-builder";
import {
  WORKER_IMPERATIVE_EFFECTS,
  WORKER_POOLED_EFFECTS,
  WORKER_UNSUPPORTED_EFFECTS,
  isWorkerEffectExact,
} from "$lib/shared/3d/worker-renderer/effects/worker-effect-support";

function prop(x = 0): PropState3D {
  return {
    centerPathAngle: 0,
    staffRotationAngle: 0,
    plane: Plane.WALL,
    worldPosition: new Vector3(x, 0, 0),
    worldRotation: new Quaternion(),
    gripType: "square",
  };
}

function input(
  effect: "trails" | "led",
  device: "capsule" | "pixel-staff" = "capsule"
): WorkerImperativeEffectFrameInput {
  return {
    performerId: "p1",
    playing: true,
    deltaSeconds: 1 / 60,
    sampledAtMs: 1_000,
    qualityTier: "high" as const,
    staffHalfLength: 0.5,
    propBuild: propFinishState.build,
    effectSpaceMatrix: new Matrix4().makeTranslation(4, 5, 6),
    left: {
      state: prop(),
      propType: PropType.STAFF,
      handPosition: { x: 0.2, z: 0.1 },
    },
    right: {
      state: null,
      propType: PropType.STAFF,
      handPosition: { x: -0.2, z: 0.1 },
    },
    tipEffectMap: { "*": { effect } },
    globalTipEffectMap: {},
    trails: DEFAULT_EFFECTS_CONFIG.trails,
    led: {
      ...DEFAULT_EFFECTS_CONFIG.led,
      device: { kind: device, ledCount: device === "capsule" ? 2 : 32 },
    },
  };
}

describe("worker imperative effect frame builder", () => {
  it("resolves default trails on the app thread into world-space clone-safe frames", () => {
    const defaultTrails = input("trails");
    defaultTrails.tipEffectMap = undefined;
    defaultTrails.globalTipEffectMap = { "*": { effect: "trails" } };
    const frames = new WorkerImperativeEffectFrameBuilder().build(
      defaultTrails
    );
    const trails = frames.filter((frame) => frame.renderer === "trail");

    expect(trails).toHaveLength(2);
    expect(trails.map((frame) => frame.sourceId)).toEqual([
      "p1:0:left-end",
      "p1:0:right-end",
    ]);
    expect(trails[0]?.position[0]).toBeGreaterThan(3);
    expect(trails[0]?.position[1]).toBe(5);
    expect(trails[0]?.config).toMatchObject({
      maxPoints: 256,
      qualityTier: "high",
      mode: "fade",
      fadeDuration: 2,
    });
    expect(() => structuredClone(frames)).not.toThrow();
  });

  it("keeps LED pattern sampling and sub-frame supersampling on the app thread", () => {
    const builder = new WorkerImperativeEffectFrameBuilder();
    const first = builder.build(input("led"));
    const secondInput = input("led");
    secondInput.left.state = prop(0.2);
    secondInput.sampledAtMs = 1_016;
    const second = builder.build(secondInput);
    const firstLed = first.find((frame) => frame.renderer === "led");
    const secondLed = second.find((frame) => frame.renderer === "led");

    expect(firstLed?.tips).toHaveLength(2);
    expect(secondLed?.tips).toHaveLength(16);
    expect(secondLed?.sampledAtSeconds).toBe(1.016);
    expect(secondLed?.tips.every((tip) => Number.isFinite(tip.speed))).toBe(
      true
    );
  });

  it("materializes a pixel-staff frame instead of substituting capsule LEDs", () => {
    const frames = new WorkerImperativeEffectFrameBuilder().build(
      input("led", "pixel-staff")
    );
    const pov = frames.find((frame) => frame.renderer === "pov");

    expect(pov).toMatchObject({ ledCount: 32, brightness: expect.any(Number) });
    expect(pov?.pattern.ledCount).toBe(32);
    expect(() => structuredClone(pov)).not.toThrow();
  });

  it("materializes the exact moon-fan diffuser frame on the app thread", () => {
    const moonInput = input("led");
    moonInput.left.propType = PropType.FAN;
    moonInput.left.state = prop();
    moonInput.propBuild = {
      ...propFinishState.build,
      fanBuild: "moon",
    };

    const frames = new WorkerImperativeEffectFrameBuilder().build(moonInput);
    const moonFan = frames.find((frame) => frame.renderer === "moon-fan");

    expect(moonFan).toMatchObject({
      sourceId: "p1:0:moon-fan",
      enabled: true,
      worldCenter: expect.any(Array),
      worldRotation: expect.any(Array),
      brightness: expect.any(Number),
      scale: 1,
    });
    expect(moonFan?.ledColors).toHaveLength(78);
    expect(() => structuredClone(moonFan)).not.toThrow();
  });

  it("names every exact and fail-closed effect family", () => {
    expect(WORKER_IMPERATIVE_EFFECTS).toEqual(["trails", "led"]);
    expect(WORKER_POOLED_EFFECTS).toEqual([
      "sparkles",
      "goo",
      "bubbles",
      "petals",
      "smoke",
      "ink",
      "silk",
      "animal",
      "pulse",
      "bloom",
      "fire",
      "charcoal",
    ]);
    expect(WORKER_UNSUPPORTED_EFFECTS).toEqual(["zap", "ghost", "frost"]);
    expect(isWorkerEffectExact("trails")).toBe(true);
    expect(isWorkerEffectExact("led")).toBe(true);
    expect(isWorkerEffectExact("none")).toBe(true);
    expect(isWorkerEffectExact("zap")).toBe(false);
    expect(isWorkerEffectExact("ghost")).toBe(false);
    expect(isWorkerEffectExact("frost")).toBe(false);
  });
});
