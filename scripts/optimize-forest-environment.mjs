#!/usr/bin/env node
/** Optimize the Blender-authored Moonlit Firefly Forest for WebGL delivery. */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const INPUT = resolve("static/models/forest/forest-environment_raw.glb");
const OUTPUT = resolve("static/models/forest/forest-environment.glb");
const TMP = resolve("static/models/forest/_forest-optimized.glb");
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
  throw new Error(`Forest source GLB does not exist: ${INPUT}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
if (existsSync(TMP)) rmSync(TMP);
try {
  run("Deduplicate and resize Forest textures", [
    "optimize",
    INPUT,
    TMP,
    "--compress",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "4096",
    "--simplify",
    "false",
    "--instance",
    "true",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  run("Apply meshopt geometry compression", ["meshopt", TMP, OUTPUT]);
} finally {
  if (existsSync(TMP)) rmSync(TMP);
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Forest asset", ["inspect", OUTPUT]);
