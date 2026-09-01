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
});
