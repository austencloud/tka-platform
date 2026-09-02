#!/usr/bin/env node
/**
 * Optimize the Flow Fest Sim Meshy car GLBs for instanced runtime use.
 *
 * Simplify stays on: Meshy 7 remeshes to ~20k triangles and thirty-two cars
 * are instanced across the lower campground, so each body wants to land well
 * under 10k. Textures resize to 1024 WebP; the cars are never inspected
 * closer than a walk-past.
 *
 * Usage:
 *   node scripts/optimize-flow-fest-cars.mjs
 *   node scripts/optimize-flow-fest-cars.mjs --only sedan-silver
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const manifest = JSON.parse(
  await readFile(resolve("scripts/flow-fest-cars-meshy-assets.json"), "utf8")
);
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
      "--simplify-ratio 0.4",
      "--simplify-error 0.001",
      "--instance false",
      "--flatten true",
    ].join(" "),
    { stdio: "inherit" }
  );
  console.log(`-> ${output} (${kb(output)} KB)`);
}
