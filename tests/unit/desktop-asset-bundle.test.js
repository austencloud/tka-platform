import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  collectDesktopAssets,
  scanAssetLiterals,
  verifyDesktopAssets,
} from "../../scripts/desktop-asset-bundle.mjs";
import { verifyDesktopGalleryBundle } from "../../scripts/verify-desktop-gallery-bundle.mjs";

const temporaryDirectories = [];

function scratch(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(dir);
  return dir;
}

function write(file, content) {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("scanAssetLiterals", () => {
  it("finds static and R2 literals and skips test/lab sources", () => {
    const src = scratch("desktop-scan-");
    write(
      join(src, "lib/shared/3d/scene.ts"),
      `const a = "/models/forest/forest-environment.glb";
       const b = '/textures/moon.png';
       const c = \`\${R2_CDN}/models/camping/tent-canvas.glb\`;
       const d = \`\${R2_CDN}/models/avatars/thumbnails/\${id}.webp\`;
       const e = "/images/props/staff.svg";`
    );
    write(
      join(src, "routes/test/harness/+page.svelte"),
      `<script>const x = "/models/bakeoff/huge.glb";</script>`
    );
    write(
      join(src, "lib/features/water-traverse/Trench.svelte"),
      `<script>const x = "/models/water-traverse/trench.glb";</script>`
    );

    const hits = scanAssetLiterals(src);
    expect([...hits.keys()].sort()).toEqual([
      "models/forest/forest-environment.glb",
      "r2/models/camping/tent-canvas.glb",
      "textures/moon.png",
    ]);
  });
});

describe("collectDesktopAssets + verifyDesktopAssets", () => {
  it("copies referenced static files, expands directories, and writes a manifest the verifier accepts", async () => {
    const root = scratch("desktop-bundle-");
    const src = join(root, "src");
    const staticRoot = join(root, "static");
    const bundleDirectory = join(root, "bundle");
    write(
      join(src, "lib/shared/3d/scene-boot/scene-asset-manifest.ts"),
      `export const M = { forest: ["/models/forest/a.glb"] };
       export const DECODERS = ["/draco/decoder.wasm"];`
    );
    write(
      join(src, "lib/shared/3d/fish.svelte"),
      `<script>const dir = "/models/ocean/pack/";</script>`
    );
    write(join(staticRoot, "models/forest/a.glb"), "glb-bytes");
    write(join(staticRoot, "draco/decoder.wasm"), "wasm-bytes");
    write(join(staticRoot, "models/ocean/pack/fish.glb"), "fish");
    write(join(staticRoot, "models/ocean/pack/fish_raw.glb"), "raw-input");

    const summary = await collectDesktopAssets({
      bundleDirectory,
      staticRoot,
      sourceRoot: src,
      extraPaths: [],
      log: () => {},
    });
    expect(summary.manifest.files.map((f) => f.path)).toEqual([
      "draco/decoder.wasm",
      "models/forest/a.glb",
      "models/ocean/pack/fish.glb",
    ]);
    expect(summary.missing).toEqual([]);
    expect(readFileSync(join(bundleDirectory, "models/forest/a.glb"), "utf8")).toBe(
      "glb-bytes"
    );

    const verified = await verifyDesktopAssets({
      bundleDirectory,
      required: ["models/forest/a.glb", "draco/decoder.wasm"],
    });
    expect(verified.fileCount).toBe(3);
  });

  it("rejects a bundle missing a required asset or with a size mismatch", async () => {
    const bundleDirectory = scratch("desktop-bundle-bad-");
    write(join(bundleDirectory, "models/a.glb"), "abc");
    write(
      join(bundleDirectory, "manifest.json"),
      JSON.stringify({ files: [{ path: "models/a.glb", bytes: 3 }], totalBytes: 3 })
    );
    await expect(
      verifyDesktopAssets({ bundleDirectory, required: ["models/b.glb"] })
    ).rejects.toThrow(/missing required offline assets/);

    write(join(bundleDirectory, "models/a.glb"), "abcd");
    await expect(
      verifyDesktopAssets({ bundleDirectory, required: [] })
    ).rejects.toThrow(/4 bytes on disk/);
  });
});

describe("verifyDesktopGalleryBundle", () => {
  it("accepts a well-formed export and rejects a count mismatch", () => {
    const dir = scratch("desktop-gallery-");
    const file = join(dir, "public-sequences.json");
    writeFileSync(
      file,
      JSON.stringify({
        exportedAt: "2026-09-02T10:00:00.000Z",
        count: 1,
        sequences: [{ id: "abc", word: "AB" }],
      })
    );
    expect(verifyDesktopGalleryBundle(file).sequenceCount).toBe(1);

    writeFileSync(
      file,
      JSON.stringify({
        exportedAt: "2026-09-02T10:00:00.000Z",
        count: 2,
        sequences: [{ id: "abc", word: "AB" }],
      })
    );
    expect(() => verifyDesktopGalleryBundle(file)).toThrow(/declares 2/);
  });

  it("flags a missing file with a distinct code", () => {
    let caught;
    try {
      verifyDesktopGalleryBundle(join(scratch("desktop-gallery-none-"), "nope.json"));
    } catch (error) {
      caught = error;
    }
    expect(caught?.code).toBe("GALLERY_BUNDLE_MISSING");
  });
});
