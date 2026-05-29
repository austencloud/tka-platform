#!/usr/bin/env node
/**
 * Optimize the raw Blender ocean scene GLB for web delivery.
 *
 * 2026 delivery format: KTX2/Basis Universal textures (GPU-compressed — stay
 * compressed in VRAM, the binding constraint on mobile WebGL) + meshopt geometry
 * (EXT_meshopt_compression, faster decode than Draco, no separate decoder fetch).
 *
 * Two hard constraints shape the pass order:
 *   - KTX-Software (toktx/ktx) reads ONLY PNG/JPEG, never WebP/AVIF. Textures must
 *     be PNG before the KTX2 passes or they are silently skipped.
 *   - gltf-transform's `optimize` CLI cannot output PNG (only ktx2/webp/avif/auto/
 *     false), and reading meshopt-compressed geometry back needs a decoder dep.
 * So we normalize textures to PNG with the core API (sharp) on UNCOMPRESSED
 * geometry, then KTX2-encode, then apply meshopt last.
 *
 * Passes:
 *   1. optimize  geometry simplify/instance/flatten + resize textures→512 (webp,
 *                to bound memory) — geometry left UNCOMPRESSED so pass 2 can read it
 *   2. (API)     normalize all textures → PNG (KTX-readable, via sharp)
 *   3. uastc     KTX2 UASTC for normal / metallicRoughness / occlusion
 *   4. etc1s     KTX2 ETC1S for baseColor / emissive
 *   5. meshopt   EXT_meshopt_compression geometry (applied last)
 *
 * KTX2 encoding needs KTX-Software; a local copy in .tools/ktx/ is put on PATH.
 *
 * Input:  static/models/ocean/ocean_scene_raw.glb   (from blender-export-ocean-full.py)
 * Output: static/models/ocean/ocean_flora_scene.glb
 *
 * Usage:  NODE_OPTIONS=--max-old-space-size=8192 node scripts/optimize-ocean-glb.mjs
 */
import { execSync } from "child_process";
import { existsSync, statSync, rmSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import sharp from "sharp";

const INPUT = resolve("static/models/ocean/ocean_scene_raw.glb");
// Profile: "base" (default, 512 all slots — byte-identical to prior builds) or
// "hi" (baseColor/emissive 1024, normal/MR/occlusion 512). Pass `--profile hi`.
const argIdx = process.argv.indexOf("--profile");
const PROFILE = argIdx !== -1 ? process.argv[argIdx + 1] : "base";
if (PROFILE !== "base" && PROFILE !== "hi") {
  console.error(`Unknown --profile "${PROFILE}" (expected "base" or "hi").`);
  process.exit(1);
}
const IS_HI = PROFILE === "hi";
const OUTPUT = resolve(
  `static/models/ocean/ocean_flora_scene${IS_HI ? "_hi" : ""}.glb`,
);
// Pass-1 resize cap. hi resizes to 1024 (color stays 1024; non-color shrunk to
// 512 in pass 2). base keeps the historical 512-everything build.
const TEXTURE_SIZE = IS_HI ? 1024 : 512;
const TMP_SLIM = resolve("static/models/ocean/_tmp_slim.glb");
const TMP_PNG = resolve("static/models/ocean/_tmp_png.glb");
const TMP_UASTC = resolve("static/models/ocean/_tmp_uastc.glb");
const TMP_ETC = resolve("static/models/ocean/_tmp_etc.glb");

// Local KTX-Software on PATH so the uastc/etc1s passes can transcode.
const KTX_BIN = resolve(".tools/ktx");
const SEP = process.platform === "win32" ? ";" : ":";
const ENV = { ...process.env, PATH: `${KTX_BIN}${SEP}${process.env.PATH}` };

// gltf-transform core/functions/extensions live in the pnpm store under the cli.
const CLI_PKG_JSON = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
);
const req = createRequire(CLI_PKG_JSON);
const { NodeIO } = await import(pathToFileURL(req.resolve("@gltf-transform/core")));
const { ALL_EXTENSIONS } = await import(
  pathToFileURL(req.resolve("@gltf-transform/extensions"))
);
const { textureCompress } = await import(
  pathToFileURL(req.resolve("@gltf-transform/functions"))
);

const fileSize = (p) => (statSync(p).size / (1024 * 1024)).toFixed(1);

function run(label, cmd) {
  console.log(`\n── ${label} ──`);
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: ENV });
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    process.exit(1);
  }
}

if (!existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}`);
  console.error("Run the Blender export first (blender-export-ocean-full.py).");
  process.exit(1);
}
if (!existsSync(resolve(KTX_BIN, "toktx.exe")) && !existsSync(resolve(KTX_BIN, "toktx"))) {
  console.error(`KTX-Software not found in ${KTX_BIN} (need toktx/ktx for KTX2).`);
  process.exit(1);
}

console.log(`Input: ${INPUT} (${fileSize(INPUT)} MB)  profile=${PROFILE} → ${OUTPUT}`);

// 1. Geometry simplify/instance/flatten + resize textures→TEXTURE_SIZE. Geometry
//    left uncompressed (--compress false) so pass 2's NodeIO read needs no codec dep.
run(
  `Geometry simplify/instance/flatten + resize→${TEXTURE_SIZE} (uncompressed geometry)`,
  [
    "npx gltf-transform optimize",
    `"${INPUT}" "${TMP_SLIM}"`,
    "--compress false",
    "--texture-compress webp",
    `--texture-size ${TEXTURE_SIZE}`,
    "--simplify true",
    // Source flora/rocks/seabed are photoscans (~7M unique verts). The OLD
    // 0.65/0.001 was a no-op: simplify-error 0.001 is a hard wall meshoptimizer
    // refuses to cross, so it bailed at ~100% and the 322M-render-vert scene
    // never loaded on mobile. Loosen error to 0.05 so the collapse actually
    // runs; 0.1 keep-ratio drops unique verts ~7M→2M (render 322M→~54M).
    // Topology/UV seams plateau it there — further render cuts need instance
    // thinning / distance LOD, not simplify.
    "--simplify-ratio 0.1",
    "--simplify-error 0.05",
    "--instance true",
    "--flatten true",
  ].join(" ")
);

// 2. Normalize textures → PNG so KTX-Software can read them (it rejects WebP).
//    hi: baseColor/emissive keep their 1024 size; normal/MR/occlusion are
//    resized down to 512 (surface-detail maps don't need the extra res, and it
//    keeps VRAM in budget). base: everything is already 512 from pass 1.
console.log("\n── Normalize textures → PNG (sharp, KTX-readable) ──");
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(TMP_SLIM);
  if (IS_HI) {
    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        slots: /(normalTexture|metallicRoughnessTexture|occlusionTexture)/,
        resize: [512, 512],
      }),
    );
    await doc.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: "png",
        slots: /(baseColorTexture|emissiveTexture)/,
      }),
    );
  } else {
    await doc.transform(
      textureCompress({ encoder: sharp, targetFormat: "png" }),
    );
  }
  await io.write(TMP_PNG, doc);
  console.log(`  wrote ${TMP_PNG} (${fileSize(TMP_PNG)} MB)`);
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

// 4. KTX2 ETC1S for color maps.
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
run("Meshopt geometry compression", `npx gltf-transform meshopt "${TMP_ETC}" "${OUTPUT}"`);

console.log(`\nOutput: ${OUTPUT} (${fileSize(OUTPUT)} MB)`);

for (const tmp of [TMP_SLIM, TMP_PNG, TMP_UASTC, TMP_ETC]) {
  if (existsSync(tmp)) rmSync(tmp);
}

// Proof: textures should read KTX2; meshes carry EXT_meshopt_compression.
run("Inspect result", `npx gltf-transform inspect "${OUTPUT}"`);
