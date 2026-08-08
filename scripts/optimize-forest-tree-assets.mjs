#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const manifestPath = resolve("scripts/forest-meshy-images.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const outputDirectory = resolve(manifest.outputDirectory);

for (const asset of manifest.assets) {
  if (only && asset.id !== only) continue;
  const input = resolve(outputDirectory, `${asset.id}_raw.glb`);
  const output = resolve(outputDirectory, `${asset.id}.glb`);
  if (!existsSync(input)) {
    console.warn(`skip ${asset.id}: ${input} missing`);
    continue;
  }
  console.log(`\n${asset.id}: ${(statSync(input).size / 1024).toFixed(1)} KiB`);
  execFileSync(
    process.execPath,
    [
      resolve("node_modules/@gltf-transform/cli/bin/cli.js"),
      "optimize",
      input,
      output,
      "--texture-compress",
      "webp",
      "--texture-size",
      String(asset.textureSize ?? 1024),
      "--compress",
      "meshopt",
      "--simplify",
      "true",
      "--simplify-error",
      "0.001",
      "--instance",
      "true",
      "--flatten",
      "true",
    ],
    { stdio: "inherit" }
  );
  console.log(`-> ${output} (${(statSync(output).size / 1024).toFixed(1)} KiB)`);
}
