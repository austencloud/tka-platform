#!/usr/bin/env node
/** Optimize the conditional Moonlit Firefly Forest close-frame layer. */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INPUT = resolve("static/models/forest/forest-near-frame_raw.glb");
const OUTPUT = resolve("static/models/forest/forest-near-frame.glb");
const TEMP = resolve("static/models/forest/_forest-near-frame-optimized.glb");
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, args) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [GLTF_TRANSFORM, ...args], {
    stdio: "inherit",
  });
}

if (!existsSync(INPUT)) {
  throw new Error(`Forest near-frame source GLB does not exist: ${INPUT}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
if (existsSync(TEMP)) rmSync(TEMP);
try {
  run("Deduplicate and resize Forest near-frame textures", [
    "optimize",
    INPUT,
    TEMP,
    "--compress",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "2048",
    "--simplify",
    "false",
    "--instance",
    "true",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  run("Apply meshopt geometry compression", ["meshopt", TEMP, OUTPUT]);
} finally {
  if (existsSync(TEMP)) rmSync(TEMP);
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Forest near-frame asset", ["inspect", OUTPUT]);
