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
const [
  { NodeIO },
  { ALL_EXTENSIONS, EXTMeshoptCompression },
  { dedup, prune, quantize, simplifyPrimitive, textureCompress, weld },
  { default: sharp },
  meshopt,
] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
  import(pathToFileURL(requireFromCli.resolve("sharp"))),
  import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
]);
await Promise.all([
  meshopt.MeshoptEncoder.ready,
  meshopt.MeshoptDecoder.ready,
  meshopt.MeshoptSimplifier.ready,
]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": meshopt.MeshoptEncoder,
    "meshopt.decoder": meshopt.MeshoptDecoder,
  });

for (const entry of conditioning.filter((candidate) => activeIds.has(candidate.id))) {
  const job = manifest.jobs.find((candidate) => candidate.id === entry.id);
  if (!job) throw new Error(`Conditioning metrics reference unknown job: ${entry.id}`);
  const input = resolve(entry.reviewGlb);
  const output = resolve(manifest.paths.candidateRoot, job.candidateFilename);
  await mkdir(dirname(output), { recursive: true });
  const document = await io.read(input);
  for (const material of document.getRoot().listMaterials()) {
    // Conditioning names each material with both of its axes, and they answer
    // different questions here. Family (foliage/wood) sets roughness. Surface
    // (cutout/opaque) sets alpha mode and sidedness -- lichen cards are wood that
    // still needs a cutout, so keying transparency off family alone would render
    // them as opaque rectangles stuck to the bark.
    const name = material.getName();
    const foliage = name.includes("_Foliage_");
    const cutout = name.includes("_Cutout_");
    if (!foliage && !name.includes("_Wood_")) {
      throw new Error(`${entry.id} has an unclassified material family: ${name}`);
    }
    if (!cutout && !name.includes("_Opaque_")) {
      throw new Error(`${entry.id} has an unclassified material surface: ${name}`);
    }
    material.setMetallicFactor(0);
    material.setRoughnessFactor(
      foliage
        ? manifest.conditioning.foliageRoughness
        : manifest.conditioning.woodRoughness
    );
    material.setAlphaMode(cutout ? "MASK" : "OPAQUE");
    material.setAlphaCutoff(
      cutout ? manifest.conditioning.foliageAlphaCutoff : 0.5
    );
    material.setDoubleSided(cutout);
    material.setEmissiveFactor([0, 0, 0]);
    material.setEmissiveTexture(null);
    material.setExtension("KHR_materials_specular", null);
    material.setExtension("KHR_materials_transmission", null);
  }
  // Geometry, not texture, is what this asset weighs: the first candidate was
  // 36.4 MiB of which textures were 1.4 MiB. Everything else was float32 vertex
  // data with no compression applied at all. weld() weights the win by merging
  // vertices the FBX round-trip split, and quantize() stores positions, normals,
  // UVs, and the wind mask at integer precision via KHR_mesh_quantization --
  // plain glTF, so it needs no decoder wired into the verifier, Blender, or the
  // runtime loader, unlike Draco or meshopt.
  // Reduction, on opaque primitives only, and bounded by error rather than by a
  // ratio. MeshoptSimplifier treats the ratio as a target it will abandon once the
  // surface would move further than `error` allows, which is the property Blender's
  // COLLAPSE decimate lacks and the reason this stage lives here: the trunk keeps
  // its silhouette because deviating from it costs too much, while genuinely
  // redundant geometry along a smooth tube goes for free.
  //
  // Cutout primitives are skipped for the same reason they are never decimated: a
  // card's shape is in its alpha mask, so there is no surface error to bound and
  // nothing to gain -- only leaves to lose. weld() runs first because the
  // simplifier needs shared vertices to collapse across, and the FBX round-trip
  // splits them.
  const reduction = job.reduction ?? {};
  let opaqueBefore = 0;
  let opaqueAfter = 0;
  if (reduction.opaqueSimplifyRatio !== undefined) {
    await document.transform(weld());
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        const name = primitive.getMaterial()?.getName() ?? "";
        if (!name.includes("_Opaque_")) continue;
        const count = (primitive.getIndices()?.getCount() ?? 0) / 3;
        opaqueBefore += count;
        simplifyPrimitive(primitive, {
          simplifier: meshopt.MeshoptSimplifier,
          ratio: reduction.opaqueSimplifyRatio,
          error: reduction.opaqueSimplifyError ?? 0.005,
          lockBorder: false,
        });
        opaqueAfter += (primitive.getIndices()?.getCount() ?? 0) / 3;
      }
    }
    console.log(
      `${entry.id}: opaque ${opaqueBefore.toLocaleString()} -> ${opaqueAfter.toLocaleString()} triangles` +
        ` (target ${reduction.opaqueSimplifyRatio}, error ${reduction.opaqueSimplifyError ?? 0.005})`
    );
  }
  await document.transform(
    dedup(),
    weld(),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
      // The wind mask lives in COLOR_0 and is read per-vertex by the shader, so it
      // keeps more precision than colour would otherwise need.
      quantizeColor: 12,
    }),
    prune()
  );
  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      // Every base-colour texture EXCEPT a cutout's, which keeps its source
      // resolution and lossless alpha: the mask edge is the silhouette of every
      // leaf and lichen in the tree, and a resized webp round-trip frays it.
      pattern: /^(?!.*_Cutout_.*_BaseColor$).+/,
      resize: [
        manifest.conditioning.optimizedTextureSize,
        manifest.conditioning.optimizedTextureSize,
      ],
    })
  );
  // Written before meshopt is applied, and it is not a debug convenience: Blender
  // ships no EXT_meshopt_compression importer, so the qualification renders --
  // the frames that decide whether a reduction cost the tree anything -- cannot
  // read the runtime file. The proof GLB is the same geometry and the same
  // materials without the codec, which is the arrangement the semantic tree
  // family already uses for the same reason.
  const proofOutput = resolve(
    manifest.paths.candidateRoot,
    job.candidateFilename.replace(/\.glb$/, "-proof.glb")
  );
  await io.write(proofOutput, document);
  // Meshopt last, and only after quantize, because it encodes the quantized
  // integer streams rather than the float ones. This is what every shipped Forest
  // tree already carries (lush-canopy-oak.glb is meshopt + webp + quantization at
  // 1.49 MiB), so the runtime loader already has the decoder wired.
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(output, document);
  console.log(`${entry.id}: ${(statSync(output).size / 1024 / 1024).toFixed(2)} MiB -> ${output}`);
}
