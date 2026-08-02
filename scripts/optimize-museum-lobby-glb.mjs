#!/usr/bin/env node
/**
 * Optimize the authored museum lobby dressing for web delivery.
 *
 * The asset is hard-surface architecture, so simplification stays disabled to
 * preserve trim profiles and lettering. Repeated ceiling fixtures are
 * GPU-instanced, while dressing nodes retain authored transforms. Duplicate
 * accessors are merged, geometry is Draco-compressed, and unused data is pruned.
 *
 * Inputs:  static/models/museum/lobby/order-lobby-{dressing,ceiling}_raw.glb
 * Outputs: static/models/museum/lobby/order-lobby-{dressing,ceiling}.glb
 */
import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { resolve } from "path";

const ASSETS = [
  {
    input: resolve("static/models/museum/lobby/order-lobby-dressing_raw.glb"),
    output: resolve("static/models/museum/lobby/order-lobby-dressing.glb"),
    instance: false,
  },
  {
    input: resolve("static/models/museum/lobby/order-lobby-ceiling_raw.glb"),
    output: resolve("static/models/museum/lobby/order-lobby-ceiling.glb"),
    instance: true,
  },
];

function fileSize(path) {
  return (statSync(path).size / 1024).toFixed(1);
}

function run(label, command) {
  console.log(`\n${label}`);
  console.log(`  $ ${command}`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`  FAILED: ${error.message}`);
    process.exit(1);
  }
}

for (const asset of ASSETS) {
  if (!existsSync(asset.input)) {
    console.error(`Input not found: ${asset.input}`);
    console.error("Run both Blender lobby exports first.");
    process.exit(1);
  }

  console.log(`Input: ${asset.input} (${fileSize(asset.input)} KB)`);

  run(
    "Optimize (dedup, instance, Draco, prune; no simplification)",
    [
      "npx gltf-transform optimize",
      `"${asset.input}" "${asset.output}"`,
      "--compress draco",
      "--simplify false",
      `--instance ${asset.instance}`,
      "--flatten false",
      "--join false",
      "--palette false",
      "--texture-compress false",
    ].join(" ")
  );

  console.log(`\nOutput: ${asset.output} (${fileSize(asset.output)} KB)`);
  run("Inspect result", `npx gltf-transform inspect "${asset.output}"`);
}
