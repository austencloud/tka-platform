import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("Autumn retained runtime lifecycle", () => {
  it("does not remount the whole runtime when quality changes", () => {
    const scene = source(
      "src/lib/shared/3d/environments/scenes/AutumnScene.svelte"
    );
    const runtime = source(
      "src/lib/shared/3d/environments/scenes/autumn/runtime/AutumnRuntimeSystems.svelte"
    );

    expect(scene).not.toMatch(/\{#key\s+tier\}/);
    expect(runtime).not.toMatch(/\{#key\s+tier\}/);
    expect(runtime).toMatch(/\{#key\s+quality\.wispCount\}/);
  });

  it("gates every per-frame Autumn owner behind a stopped task", () => {
    const taskOwners = [
      "src/lib/shared/3d/environments/primitives/FallingParticles.svelte",
      "src/lib/shared/3d/environments/scenes/autumn/runtime/interaction/AutumnInteraction.svelte",
      "src/lib/shared/3d/environments/scenes/autumn/runtime/lighting/AutumnLanternFlicker.svelte",
      "src/lib/shared/3d/environments/scenes/autumn/runtime/water/AutumnPond.svelte",
      "src/lib/shared/3d/environments/scenes/autumn/runtime/wind/AutumnWind.svelte",
      "src/lib/shared/3d/environments/scenes/autumn/runtime/wisps/WillOWisps.svelte",
    ];

    for (const path of taskOwners) {
      const component = source(path);
      expect(component, path).toMatch(/autoStart:\s*false/);
      expect(component, path).toMatch(
        /\$effect\(\(\) => \{[\s\S]*?\bactive\b[\s\S]*?\.stop\(\)/
      );
    }
  });

  it("uploads one reduced-motion particle pose before stopping", () => {
    const particles = source(
      "src/lib/shared/3d/environments/primitives/FallingParticles.svelte"
    );

    expect(particles).toContain("uploadedStillFrame");
    expect(particles).toContain("activeMotionScale === 0");
    expect(particles).toContain("particleTask.stop()");
  });

  it("registers pointer listeners only inside the active interaction effect", () => {
    const interaction = source(
      "src/lib/shared/3d/environments/scenes/autumn/runtime/interaction/AutumnInteraction.svelte"
    );
    const activeGuard = interaction.indexOf("if (!active)");
    const listener = interaction.indexOf(
      'window.addEventListener("pointermove", onPointerMove)'
    );

    expect(activeGuard).toBeGreaterThan(-1);
    expect(listener).toBeGreaterThan(activeGuard);
    expect(interaction).toContain(
      'window.removeEventListener("pointermove", onPointerMove)'
    );
  });

  it("releases the dedicated Autumn GLTF after restoring spatial batches", () => {
    const scene = source(
      "src/lib/shared/3d/environments/scenes/AutumnScene.svelte"
    );
    const restore = scene.indexOf("restoreAutumnGeometryTier(loaded)");
    const dispose = scene.indexOf("disposeSceneGraph(loaded)");

    expect(scene).toContain(
      'import { disposeSceneGraph } from "../utils/dispose-scene"'
    );
    expect(restore).toBeGreaterThan(-1);
    expect(dispose).toBeGreaterThan(restore);
  });

  it("keeps the interactive framebuffer discardable without breaking capture", () => {
    const viewer = source("src/lib/shared/3d/components/Viewer3DCanvas.svelte");
    const postProcessing = source(
      "src/lib/shared/3d/effects/post-processing/ScenePostProcessing.svelte"
    );

    expect(viewer).toContain("preserveDrawingBuffer: false");
    expect(viewer).toContain("<InteractiveCanvasFrameBridge />");
    expect(postProcessing).toContain("registerInteractiveCanvasFrameProvider");
    expect(postProcessing).toContain("renderCurrentFrame(0, true)");
  });

  it("keeps Autumn shadows live when the composer pauses for export", () => {
    const postProcessing = source(
      "src/lib/shared/3d/effects/post-processing/ScenePostProcessing.svelte"
    );

    expect(postProcessing).not.toContain("renderer.shadowMap.enabled = false");
    expect(postProcessing).toContain("oceanRendererState.shadowMapEnabled");
  });

  it("replays the reported ground-edge view against a deterministic production load", () => {
    const route = source("src/routes/test/autumn-scene/+page.svelte");
    const harness = source(
      "src/routes/test/autumn-scene/AutumnProductionHarness.svelte"
    );

    expect(route).toContain("overlook:");
    expect(route).toContain("position: [-51.21, 43.81, 25.07]");
    expect(route).toContain("target: [1.27, 8.56, -4.99]");
    expect(route).toContain("{cameraPreset}");
    expect(route).toContain("<SceneShaderWarmup");
    expect(route).toContain("waitForAllFeatures={true}");
    expect(route).toContain("sceneFeatureState.allEnabledReady");
    expect(route).toContain("productionReady");
    expect(harness).toContain("performers: REVIEW_PERFORMERS");
    expect(harness).toContain('effect: "trails"');
    expect(harness).toContain('effect: "fire"');
    expect(harness).toContain('effect: "led"');
    expect(harness).toContain("cameraMaxOrbitDistance={128}");
    expect(harness).toContain("cameraFov={cameraPreset.fov}");
    expect(harness).toContain("onSceneReadyChange={onReadyChange}");
  });

  it("routes cancellation into an Autumn-owned GLTF transport", () => {
    const scene = source(
      "src/lib/shared/3d/environments/scenes/AutumnScene.svelte"
    );
    const transport = source(
      "src/lib/shared/3d/environments/scenes/autumn/runtime/autumn-environment-transport.ts"
    );

    expect(scene).toContain("load: loadAutumnEnvironment");
    expect(scene).toContain(
      "onDiscard: (loaded) => disposeSceneGraph(loaded.scene)"
    );
    expect(transport).toContain("new LoadingManager()");
    expect(transport).toContain("manager.abort()");
  });
});
