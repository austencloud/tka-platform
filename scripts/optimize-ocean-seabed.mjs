#!/usr/bin/env node
/**
 * Optimize the sculpted seabed terrain for web delivery.
 *
 * Deliberately NOT optimize-ocean-glb.mjs. That pass runs `simplify 0.65`,
 * which is correct for a 54M-vertex reef and wrong here: this mesh IS the
 * shape of the world, and collapsing its edges rounds off the shelf lip — the
 * one silhouette the whole gate depends on. 24,770 vertices is already cheap.
 *
 * So: textures compressed, geometry left alone.
 *
 * Input:  static/models/ocean/ocean_seabed_raw.glb   (blender-export-ocean-seabed.py)
 * Output: static/models/ocean/ocean-environment.glb  (loaded at every quality tier)
 */
import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { createRequire } from "module";
import { resolve } from "path";
import { pathToFileURL } from "url";

// gltf-transform core lives in the pnpm store under the cli, same as
// optimize-ocean-glb.mjs resolves it.
const req = createRequire(
  resolve(
    "node_modules/.pnpm/@gltf-transform+cli@4.3.0/node_modules/@gltf-transform/cli/package.json"
  )
);
const { NodeIO } = await import(
  pathToFileURL(req.resolve("@gltf-transform/core"))
);
const { ALL_EXTENSIONS } = await import(
  pathToFileURL(req.resolve("@gltf-transform/extensions"))
);

/**
 * The sand albedo is a warm salmon that fights every other hue in a twilight
 * reef — it was the loudest thing in the Gate 3 hero frame. The material is
 * texture-driven, so there is no flat colour in Blender to retune; per the
 * glTF spec baseColorFactor multiplies the base colour texture, which lets us
 * grade the sand exactly without touching the image or re-exporting.
 *
 * Chosen to hold luminance while pulling red down and blue up: the sand stays
 * sand, it just stops being orange.
 */
const SAND_TINT = [0.68, 0.82, 1.0, 1.0];
const SAND_MATERIAL = "Seabed_Sand_PBR";

const INPUT = resolve("static/models/ocean/ocean_seabed_raw.glb");
const OUTPUT = resolve("static/models/ocean/ocean-environment.glb");
// Staged through a temp file: the dev server keeps the live GLB open, and
// writing it repeatedly mid-pass fails on Windows.
const STAGE = resolve("static/models/ocean/.ocean-environment.stage.glb");

if (!existsSync(INPUT)) {
  console.error(`Missing ${INPUT}. Run blender-export-ocean-seabed.py first.`);
  process.exit(1);
}

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2);
console.log(`Input:  ${mb(INPUT)} MB`);

execSync(
  [
    "npx --yes @gltf-transform/cli optimize",
    JSON.stringify(INPUT),
    JSON.stringify(STAGE),
    "--texture-compress webp",
    "--texture-size 2048",
    "--simplify false",
    // Geometry left uncompressed so the grade below can read the file back;
    // meshopt is applied as the final pass instead.
    "--compress false",
    "--instance false",
    "--join false",
  ].join(" "),
  { stdio: "inherit" }
);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(STAGE);
const sand = doc
  .getRoot()
  .listMaterials()
  .find((m) => m.getName() === SAND_MATERIAL);
if (!sand) {
  // Failing loudly beats silently shipping salmon sand.
  const names = doc.getRoot().listMaterials().map((m) => m.getName());
  console.error(`Expected material ${SAND_MATERIAL}; found: ${names.join(", ")}`);
  process.exit(1);
}
sand.setBaseColorFactor(SAND_TINT);
await io.write(STAGE, doc);
console.log(`Graded ${SAND_MATERIAL} baseColorFactor -> ${SAND_TINT.join(", ")}`);

execSync(
  `npx --yes @gltf-transform/cli meshopt ${JSON.stringify(STAGE)} ${JSON.stringify(OUTPUT)}`,
  { stdio: "inherit" }
);

console.log(`Output: ${mb(OUTPUT)} MB`);
