#!/usr/bin/env node
/**
 * Optimize First Fire coal-room Meshy GLBs for mobile WebGL.
 *
 * Unlike the autumn set, glow does NOT live in these textures: the manifest
 * forbids baked emissive because this room's light has to come from the coals
 * the runtime controls. Verified after generation - both probe assets came back
 * with an all-black emissive map. If a future asset arrives with a lit albedo,
 * fix the prompt and regenerate rather than compensating here.
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const manifest = JSON.parse(
  await readFile(resolve("scripts/first-fire-meshy-assets.json"), "utf8")
);
const kb = (p) => (statSync(p).size / 1024).toFixed(1);
const DIR = "static/models/first-fire/props";

for (const asset of manifest.assets) {
  if (only && asset.id !== only) continue;
  const input = resolve(`${DIR}/${asset.id}_raw.glb`);
  const output = resolve(`${DIR}/${asset.id}.glb`);
  if (!existsSync(input)) {
    console.warn(`skip ${asset.id}: not generated yet`);
    continue;
  }
  console.log(`\n${asset.id}: ${kb(input)} KB`);
  execSync(
    [
      "npx gltf-transform optimize",
      `"${input}" "${output}"`,
      "--texture-compress webp",
      `--texture-size ${Number(asset.textureSize) || 1024}`,
      "--compress meshopt",
      "--simplify-error 0.001",
      "--no-palette",
    ].join(" "),
    { stdio: "inherit" }
  );
  console.log(`${asset.id}: -> ${kb(output)} KB`);
}
