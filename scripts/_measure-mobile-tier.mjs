#!/usr/bin/env node
/**
 * THROWAWAY measurement: mobile tier size = all-ETC1S (no UASTC) + meshopt.
 * Same geometry/size as desktop build; only codec routing differs.
 * Output: ocean_flora_scene_mobile.glb  (does NOT touch the desktop build)
 * Run:    NODE_OPTIONS=--max-old-space-size=8192 node scripts/_measure-mobile-tier.mjs
 */
import { execSync } from "child_process";
import { existsSync, statSync, rmSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import sharp from "sharp";

const INPUT = resolve("static/models/ocean/ocean_scene_raw.glb");
const OUTPUT = resolve("static/models/ocean/ocean_flora_scene_decimated.glb");
const TMP_SLIM = resolve("static/models/ocean/_md_slim.glb");
const TMP_PNG = resolve("static/models/ocean/_md_png.glb");
const TMP_ETC = resolve("static/models/ocean/_md_etc.glb");

const KTX_BIN = resolve(".tools/ktx");
const SEP = process.platform === "win32" ? ";" : ":";
const ENV = { ...process.env, PATH: `${KTX_BIN}${SEP}${process.env.PATH}` };

const CLI_PKG_JSON = resolve(
  "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
);
const req = createRequire(CLI_PKG_JSON);
const { NodeIO } = await import(pathToFileURL(req.resolve("@gltf-transform/core")));
const { ALL_EXTENSIONS } = await import(pathToFileURL(req.resolve("@gltf-transform/extensions")));
const { textureCompress } = await import(pathToFileURL(req.resolve("@gltf-transform/functions")));

const fileSize = (p) => (statSync(p).size / (1024 * 1024)).toFixed(1);
function run(label, cmd) {
  console.log(`\n── ${label} ──`);
  try {
    execSync(cmd, { stdio: "inherit", env: ENV });
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    process.exit(1);
  }
}

console.log(`Input: ${INPUT} (${fileSize(INPUT)} MB)`);

run(
  "Geometry slim + resize→1024 (uncompressed)",
  [
    "npx gltf-transform optimize",
    `"${INPUT}" "${TMP_SLIM}"`,
    "--compress false",
    "--texture-compress webp",
    "--texture-size 1024",
    "--simplify true",
    "--simplify-ratio 0.25",
    "--simplify-error 0.02",
    "--instance true",
    "--flatten true",
  ].join(" ")
);

console.log("\n── Normalize textures → PNG ──");
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(TMP_SLIM);
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: "png" }));
  await io.write(TMP_PNG, doc);
  console.log(`  wrote ${TMP_PNG} (${fileSize(TMP_PNG)} MB)`);
}

// ALL textures → ETC1S (no UASTC). No --slots filter = every eligible texture.
run("KTX2 ETC1S (ALL textures)", `npx gltf-transform etc1s "${TMP_PNG}" "${TMP_ETC}" --quality 200`);

run("Meshopt geometry", `npx gltf-transform meshopt "${TMP_ETC}" "${OUTPUT}"`);

console.log(`\nMOBILE OUTPUT: ${OUTPUT} (${fileSize(OUTPUT)} MB)`);

for (const tmp of [TMP_SLIM, TMP_PNG, TMP_ETC]) if (existsSync(tmp)) rmSync(tmp);
run("Inspect", `npx gltf-transform inspect "${OUTPUT}"`);
