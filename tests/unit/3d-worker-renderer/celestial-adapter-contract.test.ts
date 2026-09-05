import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  resolve("src/lib/shared/3d/environments/scenes/CelestialScene.svelte"),
  "utf8"
);
const workerSource = readFileSync(
  resolve(
    "src/lib/shared/3d/worker-renderer/worlds/celestial-prototype-world.ts"
  ),
  "utf8"
);

describe("Celestial shared-world adapters", () => {
  it("keeps the Svelte scene renderer-neutral and lifecycle-only", () => {
    expect(sceneSource).toContain("createLoadedCelestialEnvironmentWorld");
    expect(sceneSource).toContain("attachCelestialEnvironmentWorld");
    expect(sceneSource).not.toMatch(/import\s+\{\s*T[,}]/);
    expect(sceneSource).not.toContain("import SkyGradient from");
    expect(sceneSource).not.toContain("import FallingParticles from");
    expect(sceneSource).not.toContain("import OliveCloudbreakSlice from");
    expect(sceneSource).not.toContain("import CelestialSun from");
  });

  it("keeps the worker adapter on the same factory and owns no scene graph", () => {
    expect(workerSource).toContain("createLoadedCelestialEnvironmentWorld");
    expect(workerSource).toContain("attachCelestialEnvironmentWorld");
    expect(workerSource).not.toContain("new Mesh(");
    expect(workerSource).not.toContain("new ShaderMaterial(");
    expect(workerSource).not.toContain("GLTFLoader");
  });
});
