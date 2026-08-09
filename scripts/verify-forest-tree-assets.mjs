#!/usr/bin/env node

import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const args = process.argv.slice(2);
const manifestIndex = args.indexOf("--manifest");
const manifestPath = resolve(
  manifestIndex >= 0
    ? args[manifestIndex + 1]
    : "scripts/forest-meshy-images.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
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
for (const asset of manifest.assets) {
  const path = resolve(manifest.outputDirectory, `${asset.id}.glb`);
  const bytes = await readFile(path);
  invariant(
    bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "glTF",
    `${asset.id} is not a GLB`
  );
  invariant(bytes.length <= 6 * 1024 * 1024, `${asset.id} exceeds 6 MiB`);
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
  invariant(
    triangles <= asset.maximumOptimizedTriangles,
    `${asset.id} has ${triangles} triangles; maximum is ${asset.maximumOptimizedTriangles}`
  );
  results.push({
    id: asset.id,
    roles: asset.roles,
    targetHeightMetres: asset.targetHeightMetres,
    bytes: statSync(path).size,
    triangles,
    materials: document.getRoot().listMaterials().length,
    textures: document.getRoot().listTextures().length,
  });
}

console.log(
  JSON.stringify(
    { contractVersion: manifest.version, assets: results },
    null,
    2
  )
);
