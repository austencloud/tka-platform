#!/usr/bin/env node
/**
 * Optimize the raw Blender stage GLB for web delivery.
 *
 * The stage is trivial low-poly geometry (box planks/legs/skirts), so mesh
 * SIMPLIFICATION is intentionally disabled — it would only risk shaving box
 * corners for no byte savings. We still dedup, GPU-instance the repeated
 * planks/legs, WebP-compress any textures, Draco-compress, and prune.
 *
 * Input:  static/models/ocean/stage_raw.glb
 * Output: static/models/ocean/stage.glb
 *
 * Usage: node scripts/optimize-stage-glb.mjs
 */
import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { resolve } from "path";

const INPUT = resolve("static/models/ocean/stage_raw.glb");
const OUTPUT = resolve("static/models/ocean/stage.glb");

function fileSize(p) {
  return (statSync(p).size / 1024).toFixed(1);
}

function run(label, cmd) {
  console.log(`\n── ${label} ──`);
  console.log(`  $ ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    process.exit(1);
  }
}

if (!existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}`);
  console.error("Run the Blender export first:");
  console.error(
    '  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/blender-export-glb.py -- --include Stage_ --output static/models/ocean/stage_raw.glb'
  );
  process.exit(1);
}

console.log(`Input: ${INPUT} (${fileSize(INPUT)} KB)`);

run(
  "Optimize (dedup→instance→webp→draco→prune, no simplify)",
  [
    "npx gltf-transform optimize",
    `"${INPUT}" "${OUTPUT}"`,
    "--texture-compress webp",
    "--texture-size 1024",
    "--compress draco",
    "--simplify false",
    "--instance true",
    "--flatten true",
  ].join(" ")
);

console.log(`\nOutput: ${OUTPUT} (${fileSize(OUTPUT)} KB)`);
run("Inspect result", `npx gltf-transform inspect "${OUTPUT}"`);
