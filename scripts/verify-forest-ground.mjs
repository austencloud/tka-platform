#!/usr/bin/env node
/** Verify the Forest living-ground source, atlas, and authored-cause contract. */

import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const contract = JSON.parse(
  await readFile(resolve("scripts/forest-ground-materials.json"), "utf8")
);
const atlasPath = resolve("static/textures/forest-floor/forest-floor-zoned.jpg");
const maskPath = resolve(
  "docs/superpowers/specs/moonlit-firefly-forest/evidence/living-ground/forest-floor-ecology-mask.png"
);
const familyMaskPath = resolve(
  "static/textures/forest-floor/forest-floor-family-mask.png"
);
const familyIds = Object.keys(contract.sourceFamilies);

assert.deepEqual(familyIds, ["neutral", "meadow", "litter", "damp"]);
assert.equal(contract.rules.requiresHabitatDrivenBlend, true);
assert.equal(contract.rules.requiresBrokenPathEdges, true);
assert.equal(contract.rules.forbidsUniformClearingTint, true);
assert.equal(contract.rules.forbidsCircularRootIslands, true);

for (const family of Object.values(contract.sourceFamilies)) {
  for (const role of ["diffuse", "normal", "roughness"]) {
    const file = resolve(family[role]);
    assert.ok((await stat(file)).size > 100_000, `${family.label} lost ${role}`);
  }
}

const atlasMetadata = await sharp(atlasPath).metadata();
assert.equal(atlasMetadata.width, contract.atlasSizePixels);
assert.equal(atlasMetadata.height, contract.atlasSizePixels);

const maskMetadata = await sharp(maskPath).metadata();
assert.equal(maskMetadata.width, 1024);
assert.equal(maskMetadata.height, 1024);
const familyMaskMetadata = await sharp(familyMaskPath).metadata();
assert.equal(familyMaskMetadata.width, 1024);
assert.equal(familyMaskMetadata.height, 1024);

const { data: atlasSample, info } = await sharp(atlasPath)
  .resize(256, 256)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const luminance = [];
const chroma = [];
for (let index = 0; index < atlasSample.length; index += info.channels) {
  const red = atlasSample[index];
  const green = atlasSample[index + 1];
  const blue = atlasSample[index + 2];
  luminance.push(red * 0.2126 + green * 0.7152 + blue * 0.0722);
  chroma.push(Math.max(red, green, blue) - Math.min(red, green, blue));
}
const minimumLuminance = Math.min(...luminance);
const maximumLuminance = Math.max(...luminance);
const averageChroma = chroma.reduce((sum, value) => sum + value, 0) / chroma.length;
assert.ok(maximumLuminance - minimumLuminance >= 48, "Atlas lost ecological contrast");
assert.ok(averageChroma >= 18, "Atlas collapsed into gray-green uniformity");

console.log(
  JSON.stringify(
    {
      contractVersion: contract.version,
      sourceFamilies: familyIds,
      atlas: {
        width: atlasMetadata.width,
        height: atlasMetadata.height,
        bytes: (await stat(atlasPath)).size,
        luminanceRange: Number((maximumLuminance - minimumLuminance).toFixed(2)),
        averageChroma: Number(averageChroma.toFixed(2)),
      },
      ecologyMask: {
        width: maskMetadata.width,
        height: maskMetadata.height,
      },
      runtimeFamilyMask: {
        width: familyMaskMetadata.width,
        height: familyMaskMetadata.height,
        bytes: (await stat(familyMaskPath)).size,
      },
    },
    null,
    2
  )
);
