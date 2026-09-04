#!/usr/bin/env node
/**
 * Optimize the Flow Fest Sim parked-car GLBs for instanced runtime use.
 *
 * The Sketchfab bodies are hand-modelled low-poly cars (18k-70k faces) with
 * 2K-4K PBR texture sets. Forty-four instances share each body's buffers, so
 * the cost that matters is texture memory, not triangles: textures resize to
 * 1024 WebP and simplification stays gentle, because the cars are inspected
 * at walking distance from the camp strips.
 *
 * Usage:
 *   node scripts/optimize-flow-fest-cars.mjs
 *   node scripts/optimize-flow-fest-cars.mjs --only fairheaven-sedan
 *   node scripts/optimize-flow-fest-cars.mjs --manifest scripts/flow-fest-cars-meshy-assets.json
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const argValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const only = argValue("--only");
const manifestPath =
  argValue("--manifest") ?? "scripts/flow-fest-cars-sketchfab-assets.json";
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const kb = (path) => (statSync(path).size / 1024).toFixed(1);

for (const asset of manifest.assets) {
  if (only && asset.id !== only) continue;
  const input = resolve(`static/models/flow-fest/cars/${asset.id}_raw.glb`);
  const output = resolve(`static/models/flow-fest/cars/${asset.id}.glb`);
  if (!existsSync(input)) {
    console.warn(`skip ${asset.id}: ${input} missing`);
    continue;
  }
  console.log(`\n${asset.id}: ${kb(input)} KB`);
  execSync(
    [
      "npx gltf-transform optimize",
      `"${input}" "${output}"`,
      "--texture-compress webp",
      "--texture-size 1024",
      "--compress meshopt",
      "--simplify true",
      "--simplify-ratio 0.75",
      "--simplify-error 0.0005",
      "--instance false",
      "--flatten true",
    ].join(" "),
    { stdio: "inherit" }
  );
  console.log(`-> ${output} (${kb(output)} KB)`);
}
