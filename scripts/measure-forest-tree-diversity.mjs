#!/usr/bin/env node
/** Measure the authored woodland's real structural diversity, not its labels. */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const layoutPath = resolve("scripts/forest-tree-layout.json");
const environmentPath = resolve("static/models/forest/forest-environment.glb");
const nearFramePath = resolve("static/models/forest/forest-near-frame.glb");
const outputPath = resolve(
  "docs/superpowers/specs/moonlit-firefly-forest/evidence/tree-diversity-r1/tree-diversity-metrics.json"
);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function readGlbJson(path) {
  const buffer = await readFile(path);
  invariant(buffer.toString("ascii", 0, 4) === "glTF", `${path} is not a GLB`);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonLength));
}

function instancedTreeMetrics(gltf) {
  const sourceCounts = {};
  const prototypeTriangles = {};
  let treeCount = 0;
  let triangleSubmissions = 0;
  for (const node of gltf.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const mesh = gltf.meshes?.[node.mesh];
    const meshName = mesh?.name ?? "";
    if (!meshName.startsWith("ForestTreeMesh_")) continue;
    const translationAccessor =
      node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
    const instanceCount =
      translationAccessor === undefined
        ? 1
        : Number(gltf.accessors?.[translationAccessor]?.count ?? 0);
    const triangles = (mesh.primitives ?? []).reduce((sum, primitive) => {
      const accessor = primitive.indices ?? primitive.attributes?.POSITION;
      return sum + Number(gltf.accessors?.[accessor]?.count ?? 0) / 3;
    }, 0);
    sourceCounts[meshName] = (sourceCounts[meshName] ?? 0) + instanceCount;
    prototypeTriangles[meshName] = triangles;
    treeCount += instanceCount;
    triangleSubmissions += triangles * instanceCount;
  }
  return {
    treeCount,
    structuralSourceCount: Object.keys(sourceCounts).length,
    sourceCounts,
    prototypeTriangles,
    triangleSubmissions,
  };
}

const layout = JSON.parse(await readFile(layoutPath, "utf8"));
const assetCounts = Object.fromEntries(
  layout.assets.map((asset) => [
    asset.id,
    layout.clusters.reduce(
      (sum, cluster) => sum + Number(cluster.counts[asset.id] ?? 0),
      0
    ),
  ])
);
const expectedSources = [];
for (const asset of layout.assets) {
  const variants = asset.variants?.length ? asset.variants : [asset];
  const count = assetCounts[asset.id];
  variants.forEach((variant, index) => {
    expectedSources.push({
      assetId: asset.id,
      variantId: variant.id ?? asset.id,
      sourcePath: variant.sourcePath ?? asset.sourcePath,
      count:
        Math.floor(count / variants.length) +
        (index < count % variants.length ? 1 : 0),
    });
  });
}

const treeCount = Object.values(assetCounts).reduce(
  (sum, count) => sum + count,
  0
);
const uniqueSourcePaths = new Set(
  expectedSources.map((source) => source.sourcePath)
);
const largestSource = [...expectedSources].sort(
  (left, right) => right.count - left.count
)[0];
const clusterProfiles = Object.fromEntries(
  layout.clusters.map((cluster) => [
    cluster.id,
    {
      habitat: cluster.habitat,
      treeCount: Object.values(cluster.counts).reduce(
        (sum, count) => sum + Number(count),
        0
      ),
      structuralFamilies: Object.values(cluster.counts).filter(
        (count) => Number(count) > 0
      ).length,
      counts: cluster.counts,
    },
  ])
);

const [environment, nearFrame] = await Promise.all([
  readGlbJson(environmentPath),
  readGlbJson(nearFramePath),
]);
const environmentMetrics = instancedTreeMetrics(environment);
const nearFrameMetrics = instancedTreeMetrics(nearFrame);

invariant(
  treeCount >= 280,
  `Woodland needs at least 280 authored trees, found ${treeCount}`
);
invariant(
  uniqueSourcePaths.size >= 10,
  "Woodland needs at least ten real sources"
);
invariant(
  largestSource.count / treeCount <= 0.2,
  "One source still dominates the woodland"
);
invariant(
  Object.values(clusterProfiles).every(
    (cluster) => cluster.structuralFamilies >= 5
  ),
  "Every habitat cluster needs at least five structural families"
);
invariant(
  environmentMetrics.structuralSourceCount === uniqueSourcePaths.size,
  "Production GLB does not contain every authored structural source"
);
invariant(
  nearFrameMetrics.structuralSourceCount === 4,
  "The stage frame needs four distinct tree silhouettes"
);

const output = {
  generatedAt: new Date().toISOString(),
  contractVersion: layout.version,
  authored: {
    treeCount,
    assetCounts,
    structuralSourceCount: uniqueSourcePaths.size,
    sourceCounts: Object.fromEntries(
      expectedSources.map((source) => [source.variantId, source.count])
    ),
    largestSource: {
      variantId: largestSource.variantId,
      count: largestSource.count,
      share: largestSource.count / treeCount,
    },
    clusterProfiles,
  },
  runtime: {
    environmentBytes: (await stat(environmentPath)).size,
    nearFrameBytes: (await stat(nearFramePath)).size,
    environment: environmentMetrics,
    nearFrame: nearFrameMetrics,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
