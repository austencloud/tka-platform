#!/usr/bin/env node
/** Optimize the production Moonlit Firefly Forest stage. */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INPUT = resolve("static/models/forest/forest-stage_raw.glb");
const OUTPUT = resolve("static/models/forest/forest-stage.glb");
const TEMP = resolve("static/models/forest/_forest-stage-optimized.glb");
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
  throw new Error(`Forest stage source GLB does not exist: ${INPUT}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
if (existsSync(TEMP)) rmSync(TEMP);
try {
  run("Deduplicate and resize Forest stage textures", [
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
run("Inspect optimized Forest stage asset", ["inspect", OUTPUT]);
