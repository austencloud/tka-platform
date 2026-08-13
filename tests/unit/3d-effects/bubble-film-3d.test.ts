import { describe, expect, it } from "vitest";
import {
  InstancedMesh,
  NormalBlending,
  Object3D,
  PerspectiveCamera,
  ShaderMaterial,
} from "three";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { resolveBubbles3D } from "$lib/shared/effects/translators/webgl3d-translator";
import type { BubbleTipSource3D } from "$lib/shared/3d/effects/scene-effects/scene-effect-source-3d";
import {
  BUBBLE_FRAGMENT_COUNT_MAX,
  BUBBLE_FRAGMENT_COUNT_MIN,
  BUBBLE_LIFETIME_SWELL,
  BUBBLE_MAX_OPACITY,
  resolveAliveBubbleFrame3D,
  resolveBubbleFragmentCount3D,
  resolveBubbleSizeMultiplier3D,
  resolvePoppingBubbleFrame3D,
} from "$lib/shared/3d/effects/bubbles/bubble-art-direction-3d";
import { createBubbleFilmMaterial3D } from "$lib/shared/3d/effects/bubbles/bubble-film-material-3d";
import { BubbleFilmPool3D } from "$lib/shared/3d/effects/bubbles/bubble-film-pool-3d";
import {
  BubbleRenderer3D,
  resolveBubbleCapacityTier3D,
} from "$lib/shared/3d/effects/bubbles/bubble-renderer-3d";

function makeSource(
  sourceId: number,
  poolSize: number,
  overrides: Partial<BubbleTipSource3D["params"]> = {}
): BubbleTipSource3D {
  return {
    effect: "bubbles",
    sourceId,
    propIndex: 0,
    tipIndex: 0,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    speed: 0,
    currentStep: 0,
    propColor: "#ffffff",
    params: resolveBubbles3D(DEFAULT_EFFECTS_CONFIG.bubbles, {
      poolSize,
      ...overrides,
    }),
  };
}

describe("3D bubble art direction", () => {
  it("biases the field toward small bubbles while keeping a bounded hero size", () => {
    const smallest = resolveBubbleSizeMultiplier3D(0, 1);
    const median = resolveBubbleSizeMultiplier3D(0.5, 1);
    const largest = resolveBubbleSizeMultiplier3D(1, 1);

    expect(smallest).toBeCloseTo(0.2448, 4);
    expect(median).toBeLessThan(largest * 0.5);
    expect(largest).toBeLessThan(1.67);
  });

  it("holds shell volume and collapses vertically during a pop", () => {
    const baseRadius = 0.1;
    const mature = resolveAliveBubbleFrame3D(baseRadius, 1, 1, 0);
    const popping = resolvePoppingBubbleFrame3D(baseRadius, 0.14);

    expect(mature.radius).toBeCloseTo(baseRadius * (1 + BUBBLE_LIFETIME_SWELL));
    expect(mature.alpha).toBeCloseTo(0);
    expect(popping.scaleY).toBeLessThan(popping.scaleX * 0.5);
    expect(popping.alpha).toBeLessThan(BUBBLE_MAX_OPACITY * 0.2);
  });

  it("keeps film fragment counts inside the authored pop range", () => {
    expect(resolveBubbleFragmentCount3D(0)).toBe(BUBBLE_FRAGMENT_COUNT_MIN);
    expect(resolveBubbleFragmentCount3D(0.5)).toBeGreaterThan(
      BUBBLE_FRAGMENT_COUNT_MIN
    );
    expect(resolveBubbleFragmentCount3D(1)).toBe(BUBBLE_FRAGMENT_COUNT_MAX);
  });
});

describe("BubbleFilmPool3D", () => {
  it("uses a clear-center Fresnel film shader with restrained normal blending", () => {
    const material = createBubbleFilmMaterial3D();

    expect(material.blending).toBe(NormalBlending);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.forceSinglePass).toBe(false);
    expect(material.vertexShader).toContain("attribute vec2 aFilm");
    expect(material.fragmentShader).toContain("float fresnel");
    expect(material.fragmentShader).toContain("vec3 interference");
    expect(material.fragmentShader).toContain("float centerFilm = 0.018");
    expect(material.fragmentShader).toContain("#include <colorspace_fragment>");
    material.dispose();

    const fragmentMaterial = createBubbleFilmMaterial3D("fragment");
    expect(fragmentMaterial.forceSinglePass).toBe(true);
    fragmentMaterial.dispose();
  });

  it("packs every shell and fragment into one stable instanced mesh", () => {
    const parent = new Object3D();
    const pool = new BubbleFilmPool3D(2);
    pool.initialize(parent);
    pool.beginFrame(2.5);
    const instance = {
      x: 1,
      y: 2,
      z: 3,
      scaleX: 0.2,
      scaleY: 0.18,
      scaleZ: 0.21,
      red: 0.3,
      green: 0.5,
      blue: 0.8,
      alpha: 0.7,
      filmSeed: 0.4,
      filmStrength: 0.9,
    };
    expect(pool.write(instance)).toBe(true);
    expect(pool.write(instance)).toBe(true);
    expect(pool.write(instance)).toBe(false);
    pool.commit();

    expect(parent.children).toEqual([pool.mesh]);
    expect(pool.mesh.count).toBe(2);
    expect(
      Array.from(pool.mesh.geometry.getAttribute("aScale").array).slice(0, 3)
    ).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0.18),
      expect.closeTo(0.21),
    ]);
    expect(pool.mesh.geometry.getAttribute("aFilm").getX(0)).toBeCloseTo(0.4);
    expect((pool.mesh.material as ShaderMaterial).uniforms.uTime?.value).toBe(
      2.5
    );

    pool.clear();
    expect(pool.mesh.count).toBe(0);
    pool.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it("sorts by view depth when radial camera distance disagrees", () => {
    const pool = new BubbleFilmPool3D(3);
    const instance = {
      x: 100,
      y: 0,
      z: -2,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      red: 1,
      green: 1,
      blue: 1,
      alpha: 1,
      filmSeed: 0,
      filmStrength: 1,
    };
    pool.beginFrame(0);
    pool.write(instance);
    pool.write({ ...instance, x: 0, z: -10 });
    pool.commit();

    const camera = new PerspectiveCamera();
    camera.updateMatrixWorld(true);
    pool.mesh.updateMatrixWorld(true);
    pool.mesh.onBeforeRender(
      null as never,
      null as never,
      camera,
      null as never,
      null as never,
      null as never
    );

    expect(pool.mesh.geometry.getAttribute("aCenter").getZ(0)).toBe(-10);
    expect(pool.mesh.geometry.getAttribute("aCenter").getZ(1)).toBe(-2);
    pool.dispose();
  });

  it("sorts with the mesh's transformed parent in the model-view path", () => {
    const parent = new Object3D();
    parent.rotation.y = Math.PI / 2;
    parent.scale.set(2, 3, 0.5);
    const pool = new BubbleFilmPool3D(2);
    pool.initialize(parent);
    const instance = {
      x: 1,
      y: 0,
      z: -100,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
      red: 1,
      green: 1,
      blue: 1,
      alpha: 1,
      filmSeed: 0,
      filmStrength: 1,
    };
    pool.beginFrame(0);
    pool.write(instance);
    pool.write({ ...instance, x: 5, z: 0 });
    pool.commit();

    const camera = new PerspectiveCamera();
    camera.updateMatrixWorld(true);
    parent.updateMatrixWorld(true);
    pool.mesh.onBeforeRender(
      null as never,
      null as never,
      camera,
      null as never,
      null as never,
      null as never
    );

    expect(pool.mesh.geometry.getAttribute("aCenter").getX(0)).toBe(5);
    expect(pool.mesh.geometry.getAttribute("aCenter").getX(1)).toBe(1);
    pool.dispose();
  });

  it("uses bounded shell tessellation and two-triangle film fragments", () => {
    const lowShells = new BubbleFilmPool3D(512, "shell");
    const highShells = new BubbleFilmPool3D(2048, "shell");
    const fragments = new BubbleFilmPool3D(2048, "fragment");

    expect(lowShells.mesh.geometry.getAttribute("position").count).toBe(60);
    expect(highShells.mesh.geometry.getAttribute("position").count).toBe(240);
    expect(fragments.mesh.geometry.index?.count).toBe(6);

    lowShells.dispose();
    highShells.dispose();
    fragments.dispose();
  });
});

describe("BubbleRenderer3D", () => {
  it("resolves and reallocates the authored 512/1024/2048 capacity tiers", () => {
    expect(resolveBubbleCapacityTier3D(1)).toBe(512);
    expect(resolveBubbleCapacityTier3D(513)).toBe(1024);
    expect(resolveBubbleCapacityTier3D(2048)).toBe(2048);

    const parent = new Object3D();
    const renderer = new BubbleRenderer3D();
    renderer.initialize(parent);
    expect(
      parent.children.map(
        (child) => (child as InstancedMesh).instanceMatrix.count
      )
    ).toEqual([512, 512]);

    renderer.update([makeSource(1, 1024)], 0);
    expect(
      parent.children.map(
        (child) => (child as InstancedMesh).instanceMatrix.count
      )
    ).toEqual([1024, 1024]);

    renderer.update([makeSource(1, 512)], 0);
    expect(
      parent.children.map(
        (child) => (child as InstancedMesh).instanceMatrix.count
      )
    ).toEqual([512, 512]);
    renderer.dispose();
  });

  it("bounds synchronized emission and lets live shells drain without sources", () => {
    const parent = new Object3D();
    const renderer = new BubbleRenderer3D();
    renderer.initialize(parent);
    const source = makeSource(1, 512, {
      ambientEmission: 1,
      motionEmission: 0,
      ambientSpawnRate: 100_000,
      lifetime: 0.2,
    });

    renderer.update([source], 1 / 60);
    const shellMesh = parent.children.find(
      (child) => child.renderOrder === 104
    ) as InstancedMesh;
    expect(shellMesh.count).toBe(512);

    renderer.update([], 1 / 60);
    expect(shellMesh.count).toBeGreaterThan(0);
    for (let frame = 0; frame < 40; frame++) renderer.update([], 1 / 60);
    expect(shellMesh.count).toBe(0);
    renderer.dispose();
  });

  it("releases per-source emission accumulators when source IDs churn", () => {
    const renderer = new BubbleRenderer3D();
    const source = makeSource(1, 512, {
      ambientEmission: 1,
      motionEmission: 0,
      ambientSpawnRate: 1,
    });
    for (let sourceId = 1; sourceId <= 200; sourceId++) {
      source.sourceId = sourceId;
      renderer.update([source], 1 / 120);
    }
    const accumulators = (
      renderer as unknown as { accumulators: Map<number, number> }
    ).accumulators;
    expect(accumulators.size).toBe(1);
    expect(accumulators.has(200)).toBe(true);
    renderer.dispose();
  });
});
