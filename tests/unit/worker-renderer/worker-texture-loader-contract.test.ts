import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("worker environment texture loading", () => {
  it("owns ordinary image decoding through ImageBitmapLoader", () => {
    const loader = source(
      "src/lib/shared/3d/worker-renderer/worlds/worker-texture-loader.ts"
    );

    expect(loader).toContain("ImageBitmapLoader");
    expect(loader).toContain('imageOrientation: "flipY"');
    expect(loader).toContain("createWorkerFlatNormalTexture");
    expect(loader).not.toMatch(/import\s*\{[^}]*\bTextureLoader\b/);
    expect(loader).not.toContain("document.");
  });

  it("keeps Winter and Forest off TextureLoader in the worker graph", () => {
    for (const path of [
      "src/lib/shared/3d/worker-renderer/worlds/winter-prototype-world.ts",
      "src/lib/shared/3d/worker-renderer/worlds/forest-prototype-world.ts",
    ]) {
      const adapter = source(path);
      expect(adapter).toContain("loadWorkerTexture");
      expect(adapter).not.toMatch(/import\s*\{[^}]*\bTextureLoader\b/);
    }
  });
});
