#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifest = JSON.parse(await readFile(resolve("scripts/forest-semantic-tree-wave-r2.json"), "utf8"));
const cli = resolve("node_modules/@gltf-transform/cli/bin/cli.js");
for (const candidate of manifest.candidates) {
  const input = resolve(manifest.outputDirectory, `${candidate.id}_semantic_review.glb`);
  const output = resolve(manifest.outputDirectory, `${candidate.id}_semantic.glb`);
  const proofOutput = resolve(manifest.outputDirectory, `${candidate.id}_semantic_proof.glb`);
  execFileSync(process.execPath, [
    cli, "optimize", input, output,
    "--texture-compress", "webp",
    "--texture-size", String(manifest.generation.optimizedTextureSize),
    "--compress", "meshopt",
    "--simplify", "false",
    "--instance", "true",
    "--flatten", "true",
  ], { stdio: "inherit" });
  execFileSync(process.execPath, [
    cli, "optimize", input, proofOutput,
    "--texture-compress", "webp",
    "--texture-size", String(manifest.generation.optimizedTextureSize),
    "--compress", "false",
    "--simplify", "false",
    "--instance", "true",
    "--flatten", "true",
  ], { stdio: "inherit" });
  console.log(`${candidate.id}: ${(statSync(output).size / 1024 / 1024).toFixed(2)} MiB`);
}
