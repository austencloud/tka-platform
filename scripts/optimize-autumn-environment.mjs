#!/usr/bin/env node
/**
 * Optimize the Blender-authored Autumn environment for WebGL delivery.
 *
 * 2026 delivery format: KTX2/Basis Universal textures (GPU-compressed - they
 * stay compressed in VRAM, which is the binding constraint on mobile WebGL)
 * plus meshopt geometry (EXT_meshopt_compression).
 *
 * This used to stop at `--texture-compress webp --texture-size 1024`, which
 * shrinks the DOWNLOAD but not the upload: WebP decodes to raw RGBA on the GPU.
 * The shipped asset measured 290.7 MB of GPU texture memory across 52 textures
 * while AutumnScene wired `useKtx2("/basis/")` for an asset that contained no
 * KTX2 at all. The passes below are ported from optimize-ocean-glb.mjs so the
 * loader's advertised format is the format the asset actually uses.
 *
 * Two hard constraints shape the pass order:
 *   - KTX-Software (toktx/ktx) reads ONLY PNG/JPEG, never WebP/AVIF. Textures
 *     must be PNG before the KTX2 passes or they are silently skipped.
 *   - gltf-transform's `optimize` CLI cannot output PNG, and reading
 *     meshopt-compressed geometry back needs a decoder dep.
 * So geometry work runs first with textures normalized to PNG via the core API
 * (sharp), then KTX2 encoding, then meshopt last.
 *
 * Passes:
 *   1. optimize  geometry simplify/instance + resize textures -> 1024 (webp),
 *                geometry left UNCOMPRESSED so pass 2 can read it
 *   2. (API)     normalize all textures -> PNG (KTX-readable, via sharp)
 *   3. uastc     KTX2 UASTC for normal / metallicRoughness / occlusion
 *   4. etc1s     KTX2 ETC1S for baseColor / emissive
 *   5. meshopt   EXT_meshopt_compression geometry (applied last)
 *
 * Input:  static/models/autumn/autumn-environment_raw.glb
 * Output: static/models/autumn/autumn-environment.glb
 */

import { execSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const INPUT = resolve("static/models/autumn/autumn-environment_raw.glb");
const OUTPUT = resolve("static/models/autumn/autumn-environment.glb");
const TMP_SLIM = resolve("static/models/autumn/_autumn-slim.glb");
const TMP_PNG = resolve("static/models/autumn/_autumn-png.glb");
const TMP_UASTC = resolve("static/models/autumn/_autumn-uastc.glb");
const TMP_ETC = resolve("static/models/autumn/_autumn-etc.glb");
const TEMPORARIES = [TMP_SLIM, TMP_PNG, TMP_UASTC, TMP_ETC];

// Local KTX-Software on PATH so the uastc/etc1s passes can transcode.
const KTX_BIN = resolve(".tools/ktx");
const SEP = process.platform === "win32" ? ";" : ":";
const ENV = { ...process.env, PATH: `${KTX_BIN}${SEP}${process.env.PATH}` };

// gltf-transform core/functions/extensions live in the pnpm store under the cli.
const CLI_PKG_JSON = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
);
const req = createRequire(CLI_PKG_JSON);
const { NodeIO } = await import(
  pathToFileURL(req.resolve("@gltf-transform/core"))
);
const { ALL_EXTENSIONS } = await import(
  pathToFileURL(req.resolve("@gltf-transform/extensions"))
);
const { textureCompress } = await import(
  pathToFileURL(req.resolve("@gltf-transform/functions"))
);

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MB`;
}

function run(label, command) {
  console.log(`\n── ${label} ──`);
  console.log(`  $ ${command}`);
  execSync(command, { stdio: "inherit", env: ENV });
}

function clean() {
  for (const path of TEMPORARIES) {
    if (existsSync(path)) rmSync(path);
  }
}

if (!existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}`);
  console.error("Run the Blender export first (blender-export-autumn-full.py).");
  process.exit(1);
}
if (
  !existsSync(resolve(KTX_BIN, "toktx.exe")) &&
  !existsSync(resolve(KTX_BIN, "toktx"))
) {
  console.error(
    `KTX-Software not found in ${KTX_BIN} (need toktx/ktx for KTX2).`
  );
  process.exit(1);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
clean();
try {
  // 1. Geometry work. Textures are resized here but left as WebP; pass 2
  //    rewrites them to PNG. Geometry stays uncompressed so pass 2's NodeIO
  //    read needs no meshopt decoder dependency.
  run(
    "Deduplicate, resize textures, and simplify conservatively",
    [
      "npx gltf-transform optimize",
      `"${INPUT}" "${TMP_SLIM}"`,
      "--compress false",
      "--texture-compress webp",
      // The terrain albedo carries the entire floor read at 5.2m per tile, so
      // it stays at 1024. ETC1S below is what actually collapses the memory.
      "--texture-size 1024",
      "--simplify true",
      "--simplify-ratio 0.55",
      "--simplify-error 0.004",
      "--instance true",
      "--flatten false",
      "--join false",
    ].join(" ")
  );

  // 2. Normalize ALL textures -> PNG so KTX-Software can read them, then drop
  //    the UASTC-bound maps to 512.
  //
  //    UASTC is the expensive format on BOTH axes: a 1024 normal map is 1.4 MB
  //    in VRAM and about 1.1 MB on disk, where the same map ETC1S-encoded would
  //    be a quarter of that. Leaving every map at 1024 produced a 38.9 MB GLB -
  //    nearly 3x the WebP build it replaced - for surface detail nobody can
  //    resolve at 15-30m. Colour stays at 1024 because ETC1S is cheap and the
  //    terrain albedo carries the floor read.
  console.log("\n── Normalize textures → PNG, UASTC slots → 512 ──");
  {
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(TMP_SLIM);
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: "png" })
    );
    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        slots: /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/,
        resize: [512, 512],
      })
    );
    await io.write(TMP_PNG, doc);
    console.log(`  wrote ${TMP_PNG} (${size(TMP_PNG)})`);
  }

  // 3. KTX2 UASTC for quality-sensitive maps.
  run(
    "KTX2 UASTC (normal / metallicRoughness / occlusion)",
    [
      "npx gltf-transform uastc",
      `"${TMP_PNG}" "${TMP_UASTC}"`,
      '--slots "{normalTexture,metallicRoughnessTexture,occlusionTexture}"',
      "--level 4",
      "--zstd 18",
    ].join(" ")
  );

  // 4. KTX2 ETC1S for colour maps. This is the pass that takes the scene's
  //    baseColor set from 4 bytes/texel to 0.25.
  run(
    "KTX2 ETC1S (baseColor / emissive)",
    [
      "npx gltf-transform etc1s",
      `"${TMP_UASTC}" "${TMP_ETC}"`,
      '--slots "{baseColorTexture,emissiveTexture}"',
      "--quality 200",
    ].join(" ")
  );

  // 5. Meshopt geometry compression, applied last (after textures are KTX2).
  run(
    "Apply meshopt geometry compression",
    `npx gltf-transform meshopt "${TMP_ETC}" "${OUTPUT}"`
  );
} finally {
  clean();
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
// Proof: textures should read KTX2 and gpuSize must land well under 100 MB.
run("Inspect optimized Autumn asset", `npx gltf-transform inspect "${OUTPUT}"`);
