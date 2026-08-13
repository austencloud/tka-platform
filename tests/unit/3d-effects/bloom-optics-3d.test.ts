import { describe, expect, it } from "vitest";
import { InstancedMesh, PointLight, Scene } from "three";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { resolveBloom3D } from "$lib/shared/effects/translators/webgl3d-translator";
import {
  resolveBloomFalloffCode,
  resolveBloomHistoryCapacity,
  resolveBloomOpticalFrame3D,
  resolveBloomSourceNormalization,
  shouldResetBloomHistory3D,
} from "$lib/shared/3d/effects/bloom/bloom-optics-3d";
import { BloomRenderer3D } from "$lib/shared/3d/effects/bloom/bloom-renderer-3d";
import { QualityTier } from "$lib/shared/3d/effects/types";
import type { BloomTipSource3D } from "$lib/shared/3d/effects/scene-effects/scene-effect-source-3d";
import { BLOOM_PRESETS } from "$lib/shared/animation-engine/components/effects-panel/presets/bloom-presets";

function makeSource(
  overrides: Partial<BloomTipSource3D> = {}
): BloomTipSource3D {
  return {
    sourceId: 1,
    propIndex: 0,
    tipIndex: 0,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 3, y: 0, z: 0 },
    speed: 3,
    currentStep: 0,
    propColor: "#3575e2",
    effect: "bloom",
    params: resolveBloom3D({
      ...DEFAULT_EFFECTS_CONFIG.bloom,
      intensity: 0.8,
      radius: 56,
      pulse: 0,
      streak: 0.7,
      spikes: 0.6,
      chromatic: 0.5,
      afterglow: 0.8,
    }),
    qualityTier: QualityTier.HIGH,
    ...overrides,
  };
}

describe("Bloom Kinetic Optics response", () => {
  it("maps every authored optical control to a material or history response", () => {
    const baseIntent = DEFAULT_EFFECTS_CONFIG.bloom;
    const low = resolveBloom3D({
      ...baseIntent,
      intensity: 0.2,
      radius: 8,
      afterglow: 0,
    });
    const high = resolveBloom3D({
      ...baseIntent,
      intensity: 1,
      radius: 90,
      afterglow: 1,
    });
    const frame = resolveBloomOpticalFrame3D(
      {
        ...high,
        pulse: 0,
        streak: 0.8,
        spikes: 0.7,
        chromatic: 0.6,
      },
      3,
      0,
      1
    );

    expect(high.haloRadiusWorld).toBeGreaterThan(low.haloRadiusWorld);
    expect(high.emissiveStrength).toBeGreaterThan(low.emissiveStrength);
    expect(high.historyLifetimeSeconds).toBeGreaterThan(
      low.historyLifetimeSeconds
    );
    expect(high.historySampleDistanceWorld).toBeLessThan(
      low.historySampleDistanceWorld
    );
    expect(frame.energy).toBeGreaterThan(0.9);
    expect(frame.stretch).toBeGreaterThan(1);
    expect(frame.streak).toBeGreaterThan(0);
    expect(frame.spikes).toBeGreaterThan(0);
    expect(frame.chromatic).toBeGreaterThan(0);
    expect(resolveBloomFalloffCode("smooth")).toBe(0);
    expect(resolveBloomFalloffCode("sharp")).toBe(1);
    expect(resolveBloomFalloffCode("ring")).toBe(0);
  });

  it("pulses exposure without making the intensity control linear", () => {
    const params = resolveBloom3D({
      ...DEFAULT_EFFECTS_CONFIG.bloom,
      intensity: 0.5,
      pulse: 1,
      pulseRate: 1,
    });
    const trough = resolveBloomOpticalFrame3D(params, 0, 0.75, 1).energy;
    const crest = resolveBloomOpticalFrame3D(params, 0, 0.25, 1).energy;
    expect(trough).toBe(0);
    expect(crest).toBeGreaterThan(0.1);
    expect(crest).toBeLessThan(0.25);
  });

  it("keeps Prism color stable while motion controls only trail length", () => {
    const prism = BLOOM_PRESETS.find((preset) => preset.id === "bloom-prism")!;
    const params = resolveBloom3D({
      ...DEFAULT_EFFECTS_CONFIG.bloom,
      ...prism.patch,
    });
    const resting = resolveBloomOpticalFrame3D(params, 0, 0, 1).chromatic;
    const moving = resolveBloomOpticalFrame3D(params, 8, 0, 1).chromatic;

    expect(resting).toBeCloseTo(0.92);
    expect(moving).toBeCloseTo(0.92);
    expect(moving).toBe(resting);

    const restingFrame = resolveBloomOpticalFrame3D(params, 0, 0, 1);
    const movingFrame = resolveBloomOpticalFrame3D(params, 8, 0, 1);
    expect(restingFrame.stretch).toBeLessThan(1.3);
    expect(movingFrame.stretch).toBeGreaterThan(restingFrame.stretch);
  });

  it("reduces Prism's footprint in dense formations without changing its spectrum", () => {
    const prism = BLOOM_PRESETS.find((preset) => preset.id === "bloom-prism")!;
    const params = resolveBloom3D({
      ...DEFAULT_EFFECTS_CONFIG.bloom,
      ...prism.patch,
    });
    const solo = resolveBloomOpticalFrame3D(params, 0, 0, 1, 1);
    const formation = resolveBloomOpticalFrame3D(params, 0, 0, 0.25, 0.55);

    expect(formation.radiusWorld).toBeLessThan(solo.radiusWorld);
    expect(formation.stretch).toBe(solo.stretch);
    expect(formation.chromatic).toBe(solo.chromatic);
  });

  it("normalizes additive energy by prop count and bounds quality history", () => {
    expect(resolveBloomSourceNormalization(1)).toBe(1);
    expect(resolveBloomSourceNormalization(4)).toBe(0.5);
    expect(resolveBloomHistoryCapacity(QualityTier.HIGH)).toBe(72);
    expect(resolveBloomHistoryCapacity(QualityTier.MEDIUM)).toBeLessThan(72);
    expect(resolveBloomHistoryCapacity(QualityTier.LOW)).toBeLessThan(
      resolveBloomHistoryCapacity(QualityTier.MEDIUM)
    );
  });

  it("resets afterglow on backward scrubs and teleports", () => {
    expect(shouldResetBloomHistory3D(4, 3, 0.1)).toBe(true);
    expect(shouldResetBloomHistory3D(4, 4.1, 2)).toBe(true);
    expect(shouldResetBloomHistory3D(4, 4.1, 0.1)).toBe(false);
  });

  it("gives every shipped preset a different dominant optical structure", () => {
    const signatures = new Map(
      BLOOM_PRESETS.map((preset) => {
        const params = resolveBloom3D({
          ...DEFAULT_EFFECTS_CONFIG.bloom,
          ...preset.patch,
        });
        const frame = resolveBloomOpticalFrame3D(params, 3, 0, 1);
        return [preset.name, { params, frame }] as const;
      })
    );

    const supernova = signatures.get("Supernova")!;
    const comet = signatures.get("Comet")!;
    const prism = signatures.get("Prism")!;
    const halo = signatures.get("Halo")!;

    expect(supernova.frame.coreStrength).toBe(1);
    expect(supernova.frame.spikes).toBeGreaterThan(prism.frame.spikes);
    expect(comet.frame.streak).toBe(1);
    expect(comet.params.historyLifetimeSeconds).toBeGreaterThan(
      supernova.params.historyLifetimeSeconds
    );
    expect(prism.frame.chromatic).toBeCloseTo(0.92);
    expect(prism.frame.coreStrength).toBeGreaterThan(0);
    expect(prism.params.colorMode).toBe("solid");
    expect(prism.params.palette).toEqual([
      "#ff1744",
      "#00e676",
      "#2979ff",
      "#ffd600",
    ]);
    expect(halo.frame.radiusWorld).toBeGreaterThan(supernova.frame.radiusWorld);
    expect(halo.frame.coreStrength).toBeLessThan(comet.frame.coreStrength);
    expect(halo.frame.streak).toBe(0);
    expect(halo.frame.spikes).toBe(0);
    expect(halo.frame.chromatic).toBe(0);
  });
});

describe("BloomRenderer3D", () => {
  it("renders live optics and exposure history through one instanced surface", () => {
    const scene = new Scene();
    const renderer = new BloomRenderer3D();
    const source = makeSource();
    renderer.initialize(scene);
    renderer.update([source], 1 / 60);
    source.position.x = 0.2;
    renderer.update([source], 1 / 60);

    const opticalMeshes = scene.children.filter(
      (child): child is InstancedMesh => child instanceof InstancedMesh
    );
    expect(opticalMeshes).toHaveLength(1);
    expect(opticalMeshes[0]!.count).toBeGreaterThan(1);
    const geometry = opticalMeshes[0]!.geometry;
    expect(
      Object.keys(geometry.attributes).filter((name) => name.startsWith("a"))
    ).toEqual([
      "aCenter",
      "aVelocitySeed",
      "aColor",
      "aOptics",
      "aLens",
      "aCoreStrength",
    ]);
    expect(geometry.getAttribute("aOptics").getZ(0)).toBeGreaterThan(1);
    expect(geometry.getAttribute("aOptics").getW(0)).toBeGreaterThan(0);
    expect(geometry.getAttribute("aLens").getX(0)).toBeGreaterThan(0);
    expect(geometry.getAttribute("aLens").getY(0)).toBeGreaterThan(0);
    expect(geometry.getAttribute("aLens").getW(1)).toBe(1);
    expect(geometry.getAttribute("aCoreStrength").getX(0)).toBeGreaterThan(0);
    expect(geometry.getAttribute("aCoreStrength").getX(1)).toBe(0);
    expect(geometry.getAttribute("aLens").getX(1)).toBe(0);
    expect(geometry.getAttribute("aLens").getY(1)).toBe(0);

    renderer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("keeps captured history color stable when the live prop color changes", () => {
    const scene = new Scene();
    const renderer = new BloomRenderer3D();
    const source = makeSource({ propColor: "#0000ff" });
    source.params = { ...source.params, colorMode: "prop-matched" };
    renderer.initialize(scene);
    renderer.update([source], 1 / 60);
    source.position.x = 0.2;
    source.propColor = "#ff0000";
    renderer.update([source], 1 / 60);

    const color = renderer.object3D.geometry.getAttribute("aColor");
    expect(color.getX(0)).toBeGreaterThan(color.getZ(0));
    expect(color.getZ(1)).toBeGreaterThan(color.getX(1));
    renderer.dispose();
  });

  it("aims Prism along tip motion and retains that axis when motion stops", () => {
    const scene = new Scene();
    const renderer = new BloomRenderer3D();
    const prism = BLOOM_PRESETS.find((preset) => preset.id === "bloom-prism")!;
    const prismParams = resolveBloom3D({
      ...DEFAULT_EFFECTS_CONFIG.bloom,
      ...prism.patch,
    });
    renderer.initialize(scene);
    const source = makeSource({
      sourceId: 1,
      tipIndex: 0,
      velocity: { x: 0, y: 3, z: 0 },
      speed: 3,
      params: prismParams,
    });
    renderer.update([source], 1 / 60);

    const axes = renderer.object3D.geometry.getAttribute("aVelocitySeed");
    const movingStretch = renderer.object3D.geometry
      .getAttribute("aOptics")
      .getZ(0);
    expect(axes.getX(0)).toBeCloseTo(0, 6);
    expect(axes.getY(0)).toBeCloseTo(1, 6);
    expect(movingStretch).toBeGreaterThan(2);

    source.velocity = { x: 0, y: 0, z: 0 };
    source.speed = 0;
    renderer.update([source], 1 / 60);
    const restingStretch = renderer.object3D.geometry
      .getAttribute("aOptics")
      .getZ(0);
    expect(axes.getY(0)).toBeCloseTo(1, 6);
    expect(restingStretch).toBeLessThan(movingStretch);
    renderer.dispose();
  });

  it("clears history on a backward step instead of drawing across a loop", () => {
    const scene = new Scene();
    const renderer = new BloomRenderer3D();
    const source = makeSource({ currentStep: 7 });
    renderer.initialize(scene);
    renderer.update([source], 1 / 60);
    source.position.x = 0.2;
    renderer.update([source], 1 / 60);
    expect(renderer.object3D.count).toBeGreaterThan(1);
    source.currentStep = 0;
    source.position.x = 10;
    renderer.update([source], 1 / 60);
    expect(renderer.object3D.count).toBe(1);
    renderer.dispose();
  });

  it("aggregates local light per prop and disables lights on low quality", () => {
    const highScene = new Scene();
    const highRenderer = new BloomRenderer3D();
    highRenderer.initialize(highScene);
    highRenderer.update(
      [
        makeSource(),
        makeSource({ sourceId: 2, tipIndex: 1 }),
        makeSource({ sourceId: 3, propIndex: 1 }),
      ],
      1 / 60
    );
    expect(
      highScene.children.filter(
        (child) => child instanceof PointLight && child.visible
      )
    ).toHaveLength(2);
    highRenderer.dispose();

    const lowScene = new Scene();
    const lowRenderer = new BloomRenderer3D();
    lowRenderer.initialize(lowScene);
    lowRenderer.update([makeSource({ qualityTier: QualityTier.LOW })], 1 / 60);
    expect(lowScene.children.some((child) => child instanceof PointLight)).toBe(
      false
    );
    lowRenderer.dispose();
  });
});
