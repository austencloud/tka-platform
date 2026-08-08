#!/usr/bin/env node
/** Optimize the Blender-authored Moonlit Winter Hollow for WebGL delivery. */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INPUT = resolve("static/models/winter/winter-environment_raw.glb");
const OUTPUT = resolve("static/models/winter/winter-environment.glb");
const TMP = resolve("static/models/winter/_winter-optimized.glb");
const TMP_INSTANCED = resolve("static/models/winter/_winter-instanced.glb");
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");
const temporaries = [TMP, TMP_INSTANCED];

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, args) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [GLTF_TRANSFORM, ...args], {
    stdio: "inherit",
  });
}

function clean() {
  for (const path of temporaries) {
    if (existsSync(path)) rmSync(path);
  }
}

if (!existsSync(INPUT)) {
  throw new Error(`Winter source GLB does not exist: ${INPUT}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
clean();
try {
  run("Deduplicate, resize textures, and simplify foliage for delivery", [
    "optimize",
    INPUT,
    TMP,
    "--compress",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "1024",
    "--simplify",
    "true",
    "--simplify-ratio",
    "0.27",
    "--simplify-error",
    "0.008",
    "--instance",
    "true",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  run("Convert linked scenery to GPU instances", [
    "instance",
    TMP,
    TMP_INSTANCED,
    "--min",
    "2",
  ]);
  run("Apply meshopt geometry compression", ["meshopt", TMP_INSTANCED, OUTPUT]);
} finally {
  clean();
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Winter asset", ["inspect", OUTPUT]);
