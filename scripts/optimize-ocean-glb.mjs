#!/usr/bin/env node
/**
 * Optimize the raw Blender ocean scene GLB for web delivery.
 *
 * Pipeline:
 * 1. Resize textures to 1024px max
 * 2. Compress textures to WebP
 * 3. Deduplicate meshes/textures
 * 4. Create GPU instances for repeated objects
 * 5. Weld vertices
 * 6. Gentle geometry simplification (keep 65%)
 * 7. Draco geometry compression
 * 8. Prune unused data
 *
 * Input:  static/models/ocean/ocean_scene_raw.glb
 * Output: static/models/ocean/ocean_flora_scene.glb
 *
 * Usage: node scripts/optimize-ocean-glb.mjs
 */
import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { resolve } from "path";

const INPUT = resolve("static/models/ocean/ocean_scene_raw.glb");
const OUTPUT = resolve("static/models/ocean/ocean_flora_scene.glb");
const TMP1 = resolve("static/models/ocean/_tmp_step1.glb");
const TMP2 = resolve("static/models/ocean/_tmp_step2.glb");

function fileSize(p) {
  return (statSync(p).size / (1024 * 1024)).toFixed(1);
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
    '  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" --background blender/ocean_scene.blend --python scripts/blender-export-ocean-full.py'
  );
  process.exit(1);
}

console.log(`Input: ${INPUT} (${fileSize(INPUT)} MB)`);

// Use gltf-transform optimize for the full pipeline
run(
  "Full optimization (resize→webp→dedup→instance→simplify→draco→prune)",
  [
    "npx gltf-transform optimize",
    `"${INPUT}" "${OUTPUT}"`,
    "--texture-compress webp",
    "--texture-size 1024",
    "--compress draco",
    "--simplify true",
    "--simplify-ratio 0.65",
    "--simplify-error 0.001",
    "--instance true",
    "--flatten true",
  ].join(" ")
);

console.log(`\nOutput: ${OUTPUT} (${fileSize(OUTPUT)} MB)`);

// Inspect result
run("Inspect result", `npx gltf-transform inspect "${OUTPUT}"`);
