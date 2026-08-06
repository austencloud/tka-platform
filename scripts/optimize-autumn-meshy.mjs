#!/usr/bin/env node
/**
 * Optimize autumn Meshy GLBs for mobile WebGL. Simplify stays ON (dense input).
 * Glow lives in the baked PBR textures; runtime adds emissive override on top.
 */
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const manifestPath = args.includes("--manifest")
  ? args[args.indexOf("--manifest") + 1]
  : "scripts/autumn-meshy-assets.json";
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const kb = (p) => (statSync(p).size / 1024).toFixed(1);

for (const a of manifest.assets) {
  if (only && a.id !== only) continue;
  const input = resolve(`static/models/autumn/${a.id}_raw.glb`);
  const output = resolve(`static/models/autumn/${a.id}.glb`);
  if (!existsSync(input)) {
    console.warn(`skip ${a.id}: ${input} missing`);
    continue;
  }
  console.log(`\n${a.id}: ${kb(input)} KB`);
  execSync(
    [
      "npx gltf-transform optimize",
      `"${input}" "${output}"`,
      "--texture-compress webp",
      `--texture-size ${Number(a.textureSize) || 1024}`,
      "--compress meshopt",
      "--simplify true",
      "--simplify-error 0.001",
      "--instance true",
      "--flatten true",
    ].join(" "),
    { stdio: "inherit" }
  );
  console.log(`-> ${output} (${kb(output)} KB)`);
}
