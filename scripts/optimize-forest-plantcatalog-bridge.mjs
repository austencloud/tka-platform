#!/usr/bin/env node

import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-plantcatalog-bridge.json"), "utf8")
);
const conditioning = JSON.parse(
  await readFile(
    resolve(manifest.paths.evidenceRoot, "plantcatalog-conditioning-metrics.json"),
    "utf8"
  )
);
const requestedJobs = process.argv
  .filter((argument) => argument.startsWith("--job="))
  .map((argument) => argument.slice("--job=".length));
const activeIds = new Set(
  requestedJobs.length > 0
    ? requestedJobs
    : manifest.exportSets[manifest.activeExportSet]
);
const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [{ NodeIO }, { ALL_EXTENSIONS }, { dedup, prune, textureCompress }, { default: sharp }] =
  await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
    import(pathToFileURL(requireFromCli.resolve("sharp"))),
  ]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

for (const entry of conditioning.filter((candidate) => activeIds.has(candidate.id))) {
  const job = manifest.jobs.find((candidate) => candidate.id === entry.id);
  if (!job) throw new Error(`Conditioning metrics reference unknown job: ${entry.id}`);
  const input = resolve(entry.reviewGlb);
  const output = resolve(manifest.paths.candidateRoot, job.candidateFilename);
  await mkdir(dirname(output), { recursive: true });
  const document = await io.read(input);
  for (const material of document.getRoot().listMaterials()) {
    const foliage = material.getName().includes("_Foliage_");
    const wood = material.getName().includes("_Wood_");
    if (!foliage && !wood) {
      throw new Error(`${entry.id} has an unclassified material: ${material.getName()}`);
    }
    material.setMetallicFactor(0);
    material.setRoughnessFactor(
      foliage
        ? manifest.conditioning.foliageRoughness
        : manifest.conditioning.woodRoughness
    );
    material.setAlphaMode(foliage ? "MASK" : "OPAQUE");
    material.setAlphaCutoff(
      foliage ? manifest.conditioning.foliageAlphaCutoff : 0.5
    );
    material.setDoubleSided(foliage);
    material.setEmissiveFactor([0, 0, 0]);
    material.setEmissiveTexture(null);
    material.setExtension("KHR_materials_specular", null);
    material.setExtension("KHR_materials_transmission", null);
  }
  await document.transform(dedup(), prune());
  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      pattern: /^(?!.*_Foliage_.*_BaseColor$).+/,
      resize: [
        manifest.conditioning.optimizedTextureSize,
        manifest.conditioning.optimizedTextureSize,
      ],
    })
  );
  await io.write(output, document);
  console.log(`${entry.id}: ${(statSync(output).size / 1024 / 1024).toFixed(2)} MiB -> ${output}`);
}
