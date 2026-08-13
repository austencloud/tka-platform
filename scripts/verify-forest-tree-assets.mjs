#!/usr/bin/env node

import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const args = process.argv.slice(2);
const onlyIndex = args.indexOf("--only");
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null;
const manifestIndex = args.indexOf("--manifest");
const manifestPath = resolve(
  manifestIndex >= 0
    ? args[manifestIndex + 1]
    : "scripts/forest-meshy-images.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const selectedAssets = manifest.assets.filter(
  (asset) => !only || asset.id === only
);
if (selectedAssets.length === 0) throw new Error(`Unknown asset: ${only}`);
const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [{ NodeIO }, { ALL_EXTENSIONS }, { MeshoptDecoder }] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
]);
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const results = [];
for (const asset of selectedAssets) {
  const path = asset.outputPath
    ? resolve(asset.outputPath)
    : resolve(manifest.outputDirectory, `${asset.id}.glb`);
  const bytes = await readFile(path);
  invariant(
    bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "glTF",
    `${asset.id} is not a GLB`
  );
  invariant(
    bytes.length <= (asset.maximumBytes ?? 6 * 1024 * 1024),
    `${asset.id} exceeds its byte budget`
  );
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  const extensions = new Set(json.extensionsUsed ?? []);
  invariant(
    extensions.has("EXT_meshopt_compression"),
    `${asset.id} lost meshopt compression`
  );
  invariant(
    extensions.has("EXT_texture_webp"),
    `${asset.id} textures are not WebP`
  );
  invariant((json.scenes?.length ?? 0) === 1, `${asset.id} needs one scene`);
  invariant((json.meshes?.length ?? 0) > 0, `${asset.id} has no meshes`);

  const document = await io.read(path);
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute("POSITION");
      triangles +=
        (primitive.getIndices()?.getCount() ?? positions?.getCount() ?? 0) / 3;
    }
  }
  invariant(triangles > 0, `${asset.id} has no triangles`);
  if (asset.maximumOptimizedTriangles) {
    invariant(
      triangles <= asset.maximumOptimizedTriangles,
      `${asset.id} has ${triangles} triangles; maximum is ${asset.maximumOptimizedTriangles}`
    );
  }
  const materialNames = document
    .getRoot()
    .listMaterials()
    .map((material) => material.getName());
  for (const pattern of asset.requiredMaterialPatterns ?? []) {
    invariant(
      materialNames.some((name) => new RegExp(pattern, "i").test(name)),
      `${asset.id} is missing a material matching ${pattern}`
    );
  }
  let foliageAlphaMaterials = 0;
  if (asset.synthesizeFoliageAlpha ?? manifest.synthesizeFoliageAlpha) {
    for (const material of document.getRoot().listMaterials()) {
      if (!/leaves|twig/i.test(material.getName())) continue;
      foliageAlphaMaterials += 1;
      invariant(
        material.getAlphaMode() === "MASK",
        `${asset.id} foliage material ${material.getName()} is not alpha-tested`
      );
      const image = material.getBaseColorTexture()?.getImage();
      invariant(
        image,
        `${asset.id} foliage material ${material.getName()} has no base-color texture`
      );
      const metadata = await sharp(image).metadata();
      const stats = await sharp(image).stats();
      const alpha = stats.channels[3];
      invariant(
        metadata.channels === 4 && alpha,
        `${asset.id} foliage material ${material.getName()} lost its alpha channel`
      );
      invariant(
        alpha.min <= 8 && alpha.max >= 247,
        `${asset.id} foliage material ${material.getName()} lacks a complete cutout range`
      );
    }
  }
  results.push({
    id: asset.id,
    roles: asset.roles,
    targetHeightMetres: asset.targetHeightMetres,
    bytes: statSync(path).size,
    triangles,
    materials: materialNames.length,
    materialNames,
    textures: document.getRoot().listTextures().length,
    foliageAlphaMaterials,
  });
}

console.log(
  JSON.stringify(
    { contractVersion: manifest.version, assets: results },
    null,
    2
  )
);
