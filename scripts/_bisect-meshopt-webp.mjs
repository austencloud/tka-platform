#!/usr/bin/env node
/**
 * DIAGNOSTIC: meshopt geometry + WebP textures, NO KTX2.
 * Isolates whether the runtime load hang is caused by KTX2 or by meshopt.
 * Output: ocean_flora_scene_meshoptwebp.glb
 * Run: NODE_OPTIONS=--max-old-space-size=8192 node scripts/_bisect-meshopt-webp.mjs
 */
import { execSync } from "child_process";
import { existsSync, statSync, rmSync } from "fs";
import { resolve } from "path";

const INPUT = resolve("static/models/ocean/ocean_scene_raw.glb");
const OUTPUT = resolve("static/models/ocean/ocean_flora_scene_meshoptwebp.glb");
const TMP = resolve("static/models/ocean/_b_slim.glb");

const fileSize = (p) => (statSync(p).size / (1024 * 1024)).toFixed(1);
function run(label, cmd) {
  console.log(`\n── ${label} ──`);
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
    process.exit(1);
  }
}

console.log(`Input: ${fileSize(INPUT)} MB`);

run(
  "Optimize (webp textures, simplify, uncompressed geometry)",
  [
    "npx gltf-transform optimize",
    `"${INPUT}" "${TMP}"`,
    "--compress false",
    "--texture-compress webp",
    "--texture-size 1024",
    "--simplify true",
    "--simplify-ratio 0.65",
    "--simplify-error 0.001",
    "--instance true",
    "--flatten true",
  ].join(" ")
);

run("Meshopt geometry only (textures stay WebP)", `npx gltf-transform meshopt "${TMP}" "${OUTPUT}"`);

console.log(`\nOUTPUT: ${fileSize(OUTPUT)} MB`);
if (existsSync(TMP)) rmSync(TMP);
run("Inspect", `npx gltf-transform inspect "${OUTPUT}"`);
