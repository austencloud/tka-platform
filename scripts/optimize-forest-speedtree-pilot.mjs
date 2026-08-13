#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-speedtree-pilot.json"), "utf8")
);
const input = resolve(manifest.candidate.rawPath);
const output = resolve(manifest.candidate.runtimePath);
const reviewOutput = resolve(manifest.candidate.reviewPath);
await mkdir(dirname(output), { recursive: true });
const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [
  { NodeIO },
  { ALL_EXTENSIONS },
  { textureCompress },
  { default: sharp },
] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
  import(pathToFileURL(requireFromCli.resolve("sharp"))),
]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(input);
for (const material of document.getRoot().listMaterials()) {
  const foliage = material.getName().includes("Foliage");
  material.setMetallicFactor(0);
  material.setRoughnessFactor(foliage ? 0.84 : 0.92);
  material.setAlphaMode(foliage ? "MASK" : "OPAQUE");
  material.setAlphaCutoff(foliage ? 0.55 : 0.5);
  material.setDoubleSided(foliage);
  material.setExtension("KHR_materials_specular", null);
  material.setExtension("KHR_materials_transmission", null);
}
await io.write(reviewOutput, document);

// Chromium renders the ORCA foliage atlases incorrectly after lossy WebP
// conversion, even though the alpha channel remains present. Keep those two
// cutout maps as their original compact PNGs and WebP-compress the opaque bark,
// cut wood, and normal maps instead.
await document.transform(
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    pattern: /^(?!T_White_Oak_Leaves_Hero_[13]_D$).+/,
    resize: [
      manifest.candidate.optimizedTextureSize,
      manifest.candidate.optimizedTextureSize,
    ],
  })
);
await io.write(output, document);

console.log(output);
