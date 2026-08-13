#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [
  { NodeIO },
  { ALL_EXTENSIONS },
  { prune },
  { MeshoptDecoder, MeshoptEncoder },
] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/functions"))),
  import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
]);

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const derivedDirectory = resolve(
  "assets/3d-source/forest/natural-derived"
);

const derivatives = [
  ...["a", "b", "c"].map((variant) => ({
    id: `fir-tree-01-${variant}`,
    input: "static/models/forest/trees/candidates/natural-tree-family-r1/fir-tree-01-family.glb",
    output: `fir-tree-01-${variant}_raw.glb`,
    nodeName: `fir_tree_01_${variant}_LOD0`,
  })),
  ...["a", "b", "c"].map((variant) => ({
    id: `fir-sapling-medium-${variant}`,
    input: "static/models/forest/trees/candidates/natural-tree-family-r1/fir-sapling-medium-family.glb",
    output: `fir-sapling-medium-${variant}_raw.glb`,
    nodeName: `fir_sapling_medium_${variant}_LOD0`,
  })),
  {
    id: "tree-small-02-leafless",
    input: "static/models/forest/trees/candidates/natural-tree-family-r1/tree-small-02.glb",
    output: "tree-small-02-leafless_raw.glb",
    removeMaterialPattern: /leaves/i,
  },
  {
    id: "island-tree-01-leafless",
    input: "static/models/forest/trees/candidates/natural-tree-family-r1/island-tree-01.glb",
    output: "island-tree-01-leafless_raw.glb",
    removeMaterialPattern: /leaves/i,
  },
];

await mkdir(derivedDirectory, { recursive: true });

for (const derivative of derivatives) {
  const document = await io.read(resolve(derivative.input));
  const root = document.getRoot();

  if (derivative.nodeName) {
    const target = root
      .listNodes()
      .find((node) => node.getName() === derivative.nodeName);
    if (!target) {
      throw new Error(
        `${derivative.id} source is missing node ${derivative.nodeName}`
      );
    }
    for (const node of [...root.listNodes()]) {
      if (node !== target) node.dispose();
    }
    target.setTranslation([0, 0, 0]);
  }

  if (derivative.removeMaterialPattern) {
    let removed = 0;
    for (const mesh of root.listMeshes()) {
      for (const primitive of [...mesh.listPrimitives()]) {
        const materialName = primitive.getMaterial()?.getName() ?? "";
        if (!derivative.removeMaterialPattern.test(materialName)) continue;
        mesh.removePrimitive(primitive);
        primitive.dispose();
        removed += 1;
      }
    }
    if (removed === 0) {
      throw new Error(`${derivative.id} removed no foliage primitives`);
    }
  }

  await document.transform(prune());
  const output = resolve(derivedDirectory, derivative.output);
  await io.write(output, document);
  console.log(`${derivative.id}: ${output}`);
}
