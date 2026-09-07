import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  resolve("src/lib/shared/3d/environments/scenes/BlossomScene.svelte"),
  "utf8"
);
const workerSource = readFileSync(
  resolve(
    "src/lib/shared/3d/worker-renderer/worlds/blossom-prototype-world.ts"
  ),
  "utf8"
);

describe("Blossom shared-world adapters", () => {
  it("keeps the Svelte scene renderer-neutral and lifecycle-only", () => {
    expect(sceneSource).toContain("createLoadedBlossomEnvironmentWorld");
    expect(sceneSource).toContain("attachBlossomEnvironmentWorld");
    expect(sceneSource).not.toMatch(/import\s+\{\s*T[,}]/);
    expect(sceneSource).not.toContain("useGltf");
    expect(sceneSource).not.toContain("import SkyGradient from");
    expect(sceneSource).not.toContain("import FallingParticles from");
    expect(sceneSource).not.toContain("import Stage3D from");
    expect(sceneSource).not.toContain("import BlossomRiver from");
    expect(sceneSource).not.toContain("import BlossomLighting from");
  });

  it("keeps the worker adapter on the same factory and owns no scene graph", () => {
    expect(workerSource).toContain("createLoadedBlossomEnvironmentWorld");
    expect(workerSource).toContain("attachBlossomEnvironmentWorld");
    expect(workerSource).not.toContain("new Mesh(");
    expect(workerSource).not.toContain("new ShaderMaterial(");
    expect(workerSource).not.toContain("GLTFLoader");
    expect(workerSource).not.toContain("Reflector");
  });
});
