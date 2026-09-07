import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  resolve("src/lib/shared/3d/environments/scenes/EmberScene.svelte"),
  "utf8"
);
const workerSource = readFileSync(
  resolve("src/lib/shared/3d/worker-renderer/worlds/ember-prototype-world.ts"),
  "utf8"
);

describe("Ember shared-world adapters", () => {
  it("keeps the Svelte adapter lifecycle-only", () => {
    expect(sceneSource).toContain("createLoadedEmberEnvironmentWorld");
    expect(sceneSource).not.toMatch(/import\s+\{\s*T[,}]/);
    expect(sceneSource).not.toContain("useGltf");
    expect(sceneSource).not.toContain("import SkyGradient from");
    expect(sceneSource).not.toContain("import LavaRivers from");
    expect(sceneSource).not.toContain("import VolcanicHaze from");
    expect(sceneSource).not.toContain("new ShaderMaterial(");
  });

  it("keeps the worker adapter on the same world factory", () => {
    expect(workerSource).toContain("createLoadedEmberEnvironmentWorld");
    expect(workerSource).not.toContain("GLTFLoader");
    expect(workerSource).not.toContain("new Mesh(");
    expect(workerSource).not.toContain("new ShaderMaterial(");
    expect(workerSource).not.toContain(".svelte");
  });
});
