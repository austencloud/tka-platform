import { describe, expect, it } from "vitest";
import { InstancedMesh, Scene } from "three";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import {
  resolveAnimal3D,
  resolveInk3D,
  resolvePulse3D,
  resolveSilk3D,
} from "$lib/shared/effects/translators/webgl3d-translator";
import { InkRenderer3D } from "$lib/shared/3d/effects/ink/ink-renderer-3d";
import { SilkRenderer3D } from "$lib/shared/3d/effects/silk/silk-renderer-3d";
import { AnimalRenderer3D } from "$lib/shared/3d/effects/animal/animal-renderer-3d";
import { PulseRenderer3D } from "$lib/shared/3d/effects/pulse/pulse-renderer-3d";
import type {
  AnimalTipSource3D,
  InkTipSource3D,
  PulseTipSource3D,
  SilkTipSource3D,
} from "$lib/shared/3d/effects/scene-effects/scene-effect-source-3d";

const base = {
  sourceId: 1,
  propIndex: 0 as const,
  tipIndex: 1 as const,
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 2, y: 0.5, z: 0 },
  speed: Math.hypot(2, 0.5),
  currentStep: 0,
  propColor: "#3575e2",
};

function visibleInstances(scene: Scene): number {
  return scene.children.reduce(
    (total, child) =>
      total + (child instanceof InstancedMesh ? child.count : 0),
    0
  );
}

function meshAtRenderOrder(scene: Scene, renderOrder: number): InstancedMesh {
  const mesh = scene.children.find(
    (child): child is InstancedMesh =>
      child instanceof InstancedMesh && child.renderOrder === renderOrder
  );
  if (!mesh)
    throw new Error(`Missing instance pool at render order ${renderOrder}`);
  return mesh;
}

describe("native 3D full-roster renderers", () => {
  it("renders pressure-reactive Ink segments and releases every pool", () => {
    const scene = new Scene();
    const renderer = new InkRenderer3D();
    renderer.initialize(scene);
    const source: InkTipSource3D = {
      ...base,
      position: { ...base.position },
      velocity: { ...base.velocity },
      effect: "ink",
      params: resolveInk3D(DEFAULT_EFFECTS_CONFIG.ink),
    };
    renderer.update([source], 1 / 60);
    source.position.x = 0.2;
    renderer.update([source], 1 / 60);
    expect(visibleInstances(scene)).toBeGreaterThanOrEqual(2);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("renders Silk as a body strip with two highlighted edges", () => {
    const scene = new Scene();
    const renderer = new SilkRenderer3D();
    renderer.initialize(scene);
    const source: SilkTipSource3D = {
      ...base,
      position: { ...base.position },
      velocity: { ...base.velocity },
      effect: "silk",
      params: resolveSilk3D(DEFAULT_EFFECTS_CONFIG.silk),
    };
    renderer.update([source], 1 / 60);
    source.position.x = 0.2;
    renderer.update([source], 1 / 60);
    expect(visibleInstances(scene)).toBe(3);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("renders a fixed-length Animal chain immediately at the tracked tip", () => {
    const scene = new Scene();
    const renderer = new AnimalRenderer3D();
    renderer.initialize(scene);
    const source: AnimalTipSource3D = {
      ...base,
      position: { ...base.position },
      velocity: { ...base.velocity },
      effect: "animal",
      params: resolveAnimal3D(DEFAULT_EFFECTS_CONFIG.animal),
    };
    renderer.update([source], 1 / 60);
    const body = meshAtRenderOrder(scene, 111);
    const centers = body.geometry.getAttribute("aCenter");
    const scales = body.geometry.getAttribute("aScale");
    expect(visibleInstances(scene)).toBeGreaterThanOrEqual(
      source.params.segmentCount
    );
    expect(centers.getX(0)).toBeCloseTo(source.position.x, 5);
    expect(centers.getY(0)).toBeCloseTo(source.position.y, 5);
    expect(centers.getZ(0)).toBeCloseTo(source.position.z, 5);
    expect(scales.getX(0)).toBeGreaterThan(0.09);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("keeps Animal's spine and visible head pinned during sub-threshold tip motion", () => {
    const scene = new Scene();
    const renderer = new AnimalRenderer3D();
    renderer.initialize(scene);
    const source: AnimalTipSource3D = {
      ...base,
      position: { ...base.position },
      velocity: { ...base.velocity },
      effect: "animal",
      params: resolveAnimal3D(DEFAULT_EFFECTS_CONFIG.animal),
    };
    renderer.update([source], 1 / 60);

    // Animal retains path points at 2.8 cm intervals, but its live anchor must
    // still follow every frame. This 1 cm move caught the old visible lag.
    source.position.x = 0.01;
    renderer.update([source], 1 / 60);

    const centers = meshAtRenderOrder(scene, 111).geometry.getAttribute(
      "aCenter"
    );
    const headIndex = source.params.segmentCount;
    expect(centers.getX(0)).toBeCloseTo(source.position.x, 5);
    expect(centers.getY(0)).toBeCloseTo(source.position.y, 5);
    expect(centers.getZ(0)).toBeCloseTo(source.position.z, 5);
    expect(centers.getX(headIndex)).toBeCloseTo(source.position.x, 5);
    expect(centers.getY(headIndex)).toBeCloseTo(source.position.y, 5);
    expect(centers.getZ(headIndex)).toBeCloseTo(source.position.z, 5);
    renderer.dispose();
  });

  it("settles a stopped Animal under its endpoint without idle tail jitter", () => {
    const scene = new Scene();
    const renderer = new AnimalRenderer3D();
    renderer.initialize(scene);
    const source: AnimalTipSource3D = {
      ...base,
      position: { ...base.position },
      velocity: { x: 3, y: 0, z: 0 },
      speed: 3,
      effect: "animal",
      params: resolveAnimal3D(DEFAULT_EFFECTS_CONFIG.animal),
    };

    for (let frame = 0; frame < 24; frame++) {
      source.position.x += 0.05;
      renderer.update([source], 1 / 60);
    }
    source.velocity = { x: 0, y: 0, z: 0 };
    source.speed = 0;
    for (let frame = 0; frame < 120; frame++) {
      renderer.update([source], 1 / 60);
    }

    const centers = meshAtRenderOrder(scene, 111).geometry.getAttribute(
      "aCenter"
    );
    const tailIndex = source.params.segmentCount - 1;
    expect(centers.getX(tailIndex)).toBeCloseTo(source.position.x, 2);
    expect(centers.getZ(tailIndex)).toBeCloseTo(source.position.z, 2);
    expect(centers.getY(tailIndex)).toBeLessThan(
      source.position.y - source.params.bodyLengthWorld * 0.98
    );

    const settledTail = [
      centers.getX(tailIndex),
      centers.getY(tailIndex),
      centers.getZ(tailIndex),
    ];
    renderer.update([source], 1 / 60);
    const idleMovement = Math.hypot(
      centers.getX(tailIndex) - settledTail[0]!,
      centers.getY(tailIndex) - settledTail[1]!,
      centers.getZ(tailIndex) - settledTail[2]!
    );
    expect(idleMovement).toBeLessThan(0.001);
    renderer.dispose();
  });

  it("resets Animal history on a loop instead of bridging across the stage", () => {
    const scene = new Scene();
    const renderer = new AnimalRenderer3D();
    renderer.initialize(scene);
    const source: AnimalTipSource3D = {
      ...base,
      currentStep: 7,
      position: { ...base.position },
      velocity: { ...base.velocity },
      effect: "animal",
      params: resolveAnimal3D(DEFAULT_EFFECTS_CONFIG.animal),
    };
    renderer.update([source], 1 / 60);
    source.currentStep = 0;
    source.position.x = 10;
    renderer.update([source], 1 / 60);

    const centers = meshAtRenderOrder(scene, 111).geometry.getAttribute(
      "aCenter"
    );
    expect(centers.getX(0)).toBeCloseTo(10, 5);
    for (let segment = 0; segment < source.params.segmentCount; segment++) {
      expect(centers.getX(segment)).toBeGreaterThan(6);
    }
    renderer.dispose();
  });

  it("gives dragon and caterpillar distinct instanced anatomy", () => {
    const ornamentCounts = new Map<string, number>();
    for (const creature of ["snake", "dragon", "caterpillar"] as const) {
      const scene = new Scene();
      const renderer = new AnimalRenderer3D();
      renderer.initialize(scene);
      const source: AnimalTipSource3D = {
        ...base,
        position: { ...base.position },
        velocity: { ...base.velocity },
        effect: "animal",
        params: resolveAnimal3D({
          ...DEFAULT_EFFECTS_CONFIG.animal,
          creature,
        }),
      };
      renderer.update([source], 1 / 60);
      ornamentCounts.set(creature, meshAtRenderOrder(scene, 113).count);
      renderer.dispose();
    }

    expect(ornamentCounts.get("snake")).toBe(0);
    expect(ornamentCounts.get("dragon")).toBeGreaterThan(0);
    expect(ornamentCounts.get("caterpillar")).toBeGreaterThan(
      ornamentCounts.get("dragon") ?? 0
    );
  });

  it("renders one Pulse on the first eligible beat and does not retrigger it each frame", () => {
    const scene = new Scene();
    const renderer = new PulseRenderer3D();
    renderer.initialize(scene);
    const source: PulseTipSource3D = {
      ...base,
      position: { ...base.position },
      velocity: { ...base.velocity },
      effect: "pulse",
      params: resolvePulse3D({
        ...DEFAULT_EFFECTS_CONFIG.pulse,
        harmonics: 0,
        chromatic: 0,
      }),
    };
    renderer.update([source], 1 / 60);
    const firstCount = visibleInstances(scene);
    renderer.update([source], 1 / 60);
    expect(firstCount).toBeGreaterThan(0);
    expect(visibleInstances(scene)).toBe(firstCount);
    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
