#!/usr/bin/env node
/** Optimize the Blender-authored First Fire Cinder Court for web delivery. */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const input = resolve("artifacts/first-fire-cinder-court-raw.glb");
const output = resolve(
  "static/models/museum/cave/first-fire-cinder-court-graybox.glb"
);
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

if (!existsSync(input)) {
  console.error(`Input not found: ${input}`);
  console.error("Run the Blender graybox export first.");
  process.exit(1);
}

mkdirSync(dirname(output), { recursive: true });

function run(label, args) {
  console.log(`\n${label}`);
  const command = [pnpm, "exec", "gltf-transform", ...args]
    .map((part) => `"${part.replaceAll('"', '\\"')}"`)
    .join(" ");
  execSync(command, {
    stdio: "inherit",
  });
}

run("Optimize First Fire Cinder Court graybox", [
  "optimize",
  input,
  output,
  "--compress",
  "draco",
  "--simplify",
  "false",
  "--instance",
  "true",
  "--flatten",
  "false",
  "--join",
  "false",
  "--palette",
  "false",
  "--texture-compress",
  "false",
]);
run("Validate optimized GLB", ["validate", output]);
run("Inspect optimized GLB", ["inspect", output]);

console.log(
  `\nFirst Fire Cinder Court graybox: ${output} (${(statSync(output).size / 1024).toFixed(1)} KB)`
);
