#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifest = JSON.parse(await readFile(resolve("scripts/forest-semantic-tree-wave-r2.json"), "utf8"));
const requireFromCli = createRequire(realpathSync(resolve("node_modules/@gltf-transform/cli/package.json")));
const [{ NodeIO }, { ALL_EXTENSIONS }] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const report = [];

for (const candidate of manifest.candidates) {
  const document = await io.read(resolve(manifest.outputDirectory, `${candidate.id}_refined_raw.glb`));
  const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const indexArray = primitive.getIndices().getArray();
  const vertexCount = primitive.getAttribute("POSITION").getCount();
  const parent = new Uint32Array(vertexCount);
  const rank = new Uint8Array(vertexCount);
  for (let index = 0; index < vertexCount; index += 1) parent[index] = index;
  function find(value) {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  }
  function union(first, second) {
    let a = find(first);
    let b = find(second);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a] += 1;
  }
  for (let offset = 0; offset < indexArray.length; offset += 3) {
    union(indexArray[offset], indexArray[offset + 1]);
    union(indexArray[offset], indexArray[offset + 2]);
  }
  const triangleCounts = new Map();
  for (let offset = 0; offset < indexArray.length; offset += 3) {
    const root = find(indexArray[offset]);
    triangleCounts.set(root, (triangleCounts.get(root) ?? 0) + 1);
  }
  const sorted = [...triangleCounts.values()].sort((a, b) => b - a);
  report.push({
    id: candidate.id,
    species: candidate.species,
    components: sorted.length,
    largestComponentTriangles: sorted[0],
    largestComponentShare: sorted[0] / (indexArray.length / 3),
    topTenTriangleCounts: sorted.slice(0, 10),
  });
}

await writeFile(resolve(manifest.evidenceDirectory, "raw-component-metrics.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
