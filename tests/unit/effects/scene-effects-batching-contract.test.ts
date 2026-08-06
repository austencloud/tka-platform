import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORCHESTRATOR = readFileSync(
  resolve("src/lib/shared/3d/effects/EffectOrchestrator3D.svelte"),
  "utf8"
);
const LAYER = readFileSync(
  resolve("src/lib/shared/3d/effects/EffectsLayer.svelte"),
  "utf8"
);
const COORDINATOR = readFileSync(
  resolve(
    "src/lib/shared/3d/effects/scene-effects/SceneEffectsCoordinator3D.svelte"
  ),
  "utf8"
);
const GHOST = readFileSync(
  resolve("src/lib/shared/3d/effects/motion/GhostStaff3D.svelte"),
  "utf8"
);
const BLOOM = readFileSync(
  resolve("src/lib/shared/3d/effects/post-processing/BloomBillboard3D.svelte"),
  "utf8"
);
const ZAP = readFileSync(
  resolve("src/lib/shared/3d/effects/energy/ElectricityArc.svelte"),
  "utf8"
);

describe("scene-level particle batching contract", () => {
  it("publishes TipPositionBridge3D results to the scene manager", () => {
    expect(ORCHESTRATOR).toContain("publishPooledTip");
    expect(ORCHESTRATOR).toContain("tip.velocity");
    expect(ORCHESTRATOR).toContain("pooledFrame.sources.push");
  });

  it("suppresses the per-tip Svelte emitters when scene batches are active", () => {
    expect(ORCHESTRATOR).toContain("pooledEffectsManaged");
    for (const effect of [
      "sparklesEnabled",
      "gooEnabled",
      "bubblesEnabled",
      "petalsEnabled",
      "smokeEnabled",
    ]) {
      expect(LAYER).toMatch(new RegExp(`!pooledEffectsManaged && ${effect}`));
    }
  });

  it("keeps one coordinator at every scene root that mounts effect orchestrators", () => {
    const roots = [
      "src/lib/shared/3d/components/Viewer3DScene.svelte",
      "src/lib/features/coven-hub/components/CovenHub.svelte",
      "src/lib/features/museum/components/game/Museum3DScene.svelte",
      "src/routes/test/effect-grid/EffectGridScene.svelte",
      "src/routes/test/element-motifs/ElementMotifScene.svelte",
    ];
    for (const root of roots) {
      const source = readFileSync(resolve(root), "utf8");
      expect(source, root).toContain("setSceneEffectsContext");
      expect(source, root).toContain("<SceneEffectsCoordinator3D");
    }
  });

  it("initializes the scene coordinator with Threlte's direct Scene value", () => {
    expect(COORDINATOR).toContain("manager.initialize(scene)");
    expect(COORDINATOR).not.toContain("scene.current");
  });

  it("shares Ghost geometry across beat snapshots and disposes it at teardown", () => {
    expect(GHOST).toContain("geometry={staffGeometry}");
    expect(GHOST).toContain("geometry={tipGeometry}");
    expect(GHOST).not.toMatch(/<T\.(?:Cylinder|Sphere)Geometry/);
    expect(GHOST).toContain("staffGeometry.dispose()");
    expect(GHOST).toContain("tipGeometry.dispose()");
  });

  it("rewrites Zap's fixed GPU buffers instead of replacing geometries", () => {
    expect(ZAP).toContain("createDynamicGeometry");
    expect(ZAP).toContain("writeLineStrip");
    expect(ZAP).toContain("writeLineSegments");
    expect(ZAP).toContain("<T.LineSegments geometry={branchGeometry}>");
    expect(ZAP.match(/new BufferGeometry\(\)/g)).toHaveLength(1);
  });

  it("shares Bloom radial masks and tints them instead of baking rainbow frames", () => {
    expect(BLOOM).toContain('<script module lang="ts">');
    expect(BLOOM).toContain("material.color.set");
    expect(BLOOM).not.toContain("rainbowTexture");
  });

  it("does not leave the retired duplicate fire emitter in the tree", () => {
    expect(
      existsSync(
        resolve("src/lib/shared/3d/effects/particles/FireEmitter.svelte")
      )
    ).toBe(false);
  });
});
