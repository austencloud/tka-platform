#!/usr/bin/env node
/** Optimize the conditional Moonlit Firefly Forest close-frame layer. */

import { execFileSync } from "node:child_process";
import { existsSync, realpathSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const INPUT = resolve("static/models/forest/forest-near-frame_raw.glb");
const OUTPUT = resolve("static/models/forest/forest-near-frame.glb");
const TEMP = resolve("static/models/forest/_forest-near-frame-optimized.glb");
const TEMP_LOD = resolve("static/models/forest/_forest-near-frame-lod.glb");
const GLTF_TRANSFORM = resolve("node_modules/@gltf-transform/cli/bin/cli.js");

function size(path) {
  return `${(statSync(path).size / 1024 / 1024).toFixed(2)} MiB`;
}

function run(label, args) {
  console.log(`\n${label}`);
  execFileSync(process.execPath, [GLTF_TRANSFORM, ...args], {
    stdio: "inherit",
  });
}

async function simplifyNearFrameTrees(input, output) {
  const requireFromCli = createRequire(
    realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
  );
  const [
    { NodeIO },
    { ALL_EXTENSIONS },
    { simplifyPrimitive },
    { MeshoptSimplifier },
  ] = await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
    import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
  ]);
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(input);
  const root = document.getRoot();
  let trianglesBefore = 0;
  let trianglesAfter = 0;
  const treeTextures = new Map();

  function registerTreeTexture(texture, maxSize, quality) {
    if (!texture) return;
    const current = treeTextures.get(texture);
    treeTextures.set(texture, {
      maxSize: Math.max(maxSize, current?.maxSize ?? 0),
      quality: Math.max(quality, current?.quality ?? 0),
    });
  }

  for (const mesh of root.listMeshes()) {
    const isTree = mesh.getName().startsWith("ForestTreeMesh_");
    const isCampShelf = mesh.getName() === "Forest Camp Shelf Mesh";
    if (!isTree && !isCampShelf) continue;
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      if (material) {
        // Keep the color-and-alpha atlas sharp enough for nearby leaf edges.
        // Surface-response maps can use a smaller tier because they add bark
        // and leaf breakup without carrying the visible silhouette.
        registerTreeTexture(material.getBaseColorTexture(), isTree ? 640 : 2048, 90);
        registerTreeTexture(material.getNormalTexture(), isTree ? 576 : 768, 88);
        registerTreeTexture(
          material.getMetallicRoughnessTexture(),
          isTree ? 384 : 768,
          86
        );
        registerTreeTexture(material.getOcclusionTexture(), isTree ? 384 : 768, 86);
      }
      if (!isTree) continue;
      const before =
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) / 3;
      trianglesBefore += before;
      const materialName = primitive.getMaterial()?.getName() ?? "";
      const isFoliage = /leaves|twig/i.test(materialName);
      if (!isFoliage && before >= 1_000) {
        simplifyPrimitive(primitive, {
          simplifier: MeshoptSimplifier,
          ratio: 0.22,
          error: 0.018,
          lockBorder: false,
        });
      }
      trianglesAfter +=
        (primitive.getIndices()?.getCount() ??
          primitive.getAttribute("POSITION")?.getCount() ??
          0) / 3;
    }
  }

  let resizedTextures = 0;
  for (const [texture, tier] of treeTextures) {
    const image = texture.getImage();
    if (!image) continue;
    const metadata = await sharp(image).metadata();
    if (
      (metadata.width ?? 0) <= tier.maxSize &&
      (metadata.height ?? 0) <= tier.maxSize
    ) {
      continue;
    }
    texture.setImage(
      await sharp(image)
        .resize(tier.maxSize, tier.maxSize, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: tier.quality, effort: 6 })
        .toBuffer()
    );
    texture.setMimeType("image/webp");
    resizedTextures += 1;
  }

  await io.write(output, document);
  console.log(
    `Simplified near-frame tree prototypes from ${Math.round(trianglesBefore).toLocaleString()} to ${Math.round(trianglesAfter).toLocaleString()} triangles`
  );
  console.log(
    `Resized ${resizedTextures} near-frame tree textures across 640 px color, 576 px normal, and 384 px response tiers`
  );
}

if (!existsSync(INPUT)) {
  throw new Error(`Forest near-frame source GLB does not exist: ${INPUT}`);
}

console.log(`Input: ${INPUT} (${size(INPUT)})`);
if (existsSync(TEMP)) rmSync(TEMP);
if (existsSync(TEMP_LOD)) rmSync(TEMP_LOD);
try {
  run("Deduplicate and resize Forest near-frame textures", [
    "optimize",
    INPUT,
    TEMP,
    "--compress",
    "false",
    "--texture-compress",
    "webp",
    "--texture-size",
    "2048",
    "--simplify",
    "false",
    "--instance",
    "true",
    "--flatten",
    "false",
    "--join",
    "false",
  ]);
  console.log("\nBuild close-frame tree LOD");
  await simplifyNearFrameTrees(TEMP, TEMP_LOD);
  run("Apply Draco geometry compression", ["draco", TEMP_LOD, OUTPUT]);
} finally {
  if (existsSync(TEMP)) rmSync(TEMP);
  if (existsSync(TEMP_LOD)) rmSync(TEMP_LOD);
}

console.log(`\nOutput: ${OUTPUT} (${size(OUTPUT)})`);
run("Inspect optimized Forest near-frame asset", ["inspect", OUTPUT]);
