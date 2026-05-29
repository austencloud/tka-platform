#!/usr/bin/env node
/**
 * Optimize a Meshy-generated stage GLB for mobile WebGL delivery.
 *
 * Meshy refine output is dense mesh with baked PBR textures (the glowing look
 * lives in the textures, not a runtime shader), so SIMPLIFICATION stays ON.
 *
 * Input:  static/models/ocean/stage_meshy_raw.glb
 * Output: static/models/ocean/stage_meshy.glb
 *
 * Usage: node scripts/optimize-stage-meshy.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INPUT = resolve("static/models/ocean/stage_meshy_raw.glb");
const OUTPUT = resolve("static/models/ocean/stage_meshy.glb");
const kb = (p) => (statSync(p).size / 1024).toFixed(1);

if (!existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}\nRun scripts/generate-stage-meshy.mjs first.`);
  process.exit(1);
}

console.log(`Input: ${INPUT} (${kb(INPUT)} KB)`);

execSync(
  [
    "npx gltf-transform optimize",
    `"${INPUT}" "${OUTPUT}"`,
    "--texture-compress webp",
    "--texture-size 2048", // hero stage keeps detail; reef textures are 1024
    "--compress draco",
    "--simplify true",
    "--simplify-error 0.001", // conservative — preserve carved-stone silhouette
    "--instance true",
    "--flatten true",
  ].join(" "),
  { stdio: "inherit" }
);

console.log(`\nOutput: ${OUTPUT} (${kb(OUTPUT)} KB)`);
execSync(`npx gltf-transform inspect "${OUTPUT}"`, { stdio: "inherit" });
