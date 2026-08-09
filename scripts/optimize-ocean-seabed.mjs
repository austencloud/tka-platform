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
import { resolve } from "path";

const INPUT = resolve("static/models/ocean/ocean_seabed_raw.glb");
const OUTPUT = resolve("static/models/ocean/ocean-environment.glb");

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
    JSON.stringify(OUTPUT),
    "--texture-compress webp",
    "--texture-size 2048",
    "--simplify false",
    "--compress meshopt",
    "--instance false",
    "--join false",
  ].join(" "),
  { stdio: "inherit" }
);

console.log(`Output: ${mb(OUTPUT)} MB`);
