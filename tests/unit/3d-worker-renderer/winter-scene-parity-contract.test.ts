import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const sceneSource = readFileSync(
  path.join(
    repoRoot,
    "src/lib/shared/3d/environments/scenes/WinterScene.svelte"
  ),
  "utf8"
);
const workerSource = readFileSync(
  path.join(
    repoRoot,
    "src/lib/shared/3d/worker-renderer/worlds/winter-prototype-world.ts"
  ),
  "utf8"
);

describe("Winter renderer parity contract", () => {
  it("keeps app and worker construction on the same world factory", () => {
    for (const source of [sceneSource, workerSource]) {
      expect(source).toContain("createWinterEnvironmentWorld");
    }
  });

  it("keeps the Svelte scene as a lifecycle adapter rather than a second look", () => {
    expect(sceneSource).not.toMatch(
      /<T\.|WinterPond|IcePlatform|FallingParticles|SkyGradient|Starfield|VolumetricFire/
    );
    expect(sceneSource).not.toContain("new FogExp2");
    expect(sceneSource).not.toContain("new Color");
  });
});
