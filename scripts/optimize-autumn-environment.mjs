#!/usr/bin/env node
/** Optimize the Blender-authored Autumn environment for WebGL delivery. */

import { execSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INPUT = resolve("static/models/autumn/autumn-environment_raw.glb");
const OUTPUT = resolve("static/models/autumn/autumn-environment.glb");
const TMP = resolve("static/models/autumn/_autumn-optimized.glb");
const TMP_INSTANCED = resolve("static/models/autumn/_autumn-instanced.glb");
const TEMPORARIES = [TMP, TMP_INSTANCED];

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MB`;
}

function run(label, command) {
  console.log(`\n── ${label} ──`);
  console.log(`  $ ${command}`);
  execSync(command, { stdio: "inherit" });
}

function clean() {
  for (const path of TEMPORARIES) {
    if (existsSync(path)) rmSync(path);
  }
}

if (!existsSync(INPUT)) {
  console.error(`Input not found: ${INPUT}`);
  process.exit(1);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
clean();
try {
  run(
    "Deduplicate, resize textures, and simplify conservatively",
    [
      "npx gltf-transform optimize",
      `"${INPUT}" "${TMP}"`,
      "--compress false",
      "--texture-compress webp",
      "--texture-size 1024",
      "--simplify true",
      "--simplify-ratio 0.55",
      "--simplify-error 0.004",
      "--instance true",
      "--flatten false",
      "--join false",
    ].join(" ")
  );
  run(
    "Convert repeated linked scenery to GPU instances",
    `npx gltf-transform instance "${TMP}" "${TMP_INSTANCED}" --min 2`
  );
  run(
    "Apply meshopt geometry compression",
    `npx gltf-transform meshopt "${TMP_INSTANCED}" "${OUTPUT}"`
  );
} finally {
  clean();
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Autumn asset", `npx gltf-transform inspect "${OUTPUT}"`);
