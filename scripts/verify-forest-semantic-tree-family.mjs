#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = JSON.parse(await readFile(resolve("scripts/forest-semantic-tree-family.json"), "utf8"));
const state = JSON.parse(await readFile(resolve(manifest.statePath), "utf8"));
const splitMetrics = JSON.parse(await readFile(resolve(manifest.evidenceDirectory, "semantic-split-metrics.json"), "utf8"));
const requireFromCli = createRequire(realpathSync(resolve("node_modules/@gltf-transform/cli/package.json")));
const [{ NodeIO, getBounds }, { ALL_EXTENSIONS }, { MeshoptDecoder }] = await Promise.all([
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
  import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
  import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
]);
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const candidates = [];
for (const candidate of manifest.candidates) {
  const path = resolve(manifest.outputDirectory, `${candidate.id}_semantic.glb`);
  const bytes = await readFile(path);
  invariant(bytes.subarray(0, 4).toString("ascii") === "glTF", `${candidate.id} is not a GLB`);
  invariant(bytes.length <= manifest.generation.maximumOptimizedBytes, `${candidate.id} exceeds byte cap`);
  const document = await io.read(path);
  const root = document.getRoot();
  let triangles = 0;
  let vertices = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute("POSITION");
      const count = positions?.getCount() ?? 0;
      vertices += count;
      triangles += (primitive.getIndices()?.getCount() ?? count) / 3;
    }
  }
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  invariant(scene, `${candidate.id} has no scene`);
  const bounds = getBounds(scene);
  const dimensions = bounds.max.map((value, axis) => value - bounds.min[axis]);
  const materials = root.listMaterials().map((material) => ({
    name: material.getName(),
    metallicFactor: material.getMetallicFactor(),
    roughnessFactor: material.getRoughnessFactor(),
    baseColorTexture: material.getBaseColorTexture()?.getName() ?? null,
    normalTexture: material.getNormalTexture()?.getName() ?? null,
    emissiveTexture: material.getEmissiveTexture()?.getName() ?? null,
    emissiveFactor: material.getEmissiveFactor(),
    alphaMode: material.getAlphaMode(),
    doubleSided: material.getDoubleSided(),
  }));
  const sourceSplit = splitMetrics.find((entry) => entry.id === candidate.id);
  invariant(sourceSplit, `${candidate.id} has no semantic split metrics`);
  invariant(root.listMeshes().length === 1, `${candidate.id} expected one instancing mesh`);
  invariant(root.listMeshes()[0].listPrimitives().length === 2, `${candidate.id} expected bark and foliage primitives`);
  invariant(materials.length === 2, `${candidate.id} expected exactly two semantic materials`);
  invariant(materials.some((material) => material.name.endsWith("_Bark")), `${candidate.id} has no Bark material`);
  invariant(materials.some((material) => material.name.endsWith("_Foliage")), `${candidate.id} has no Foliage material`);
  invariant(materials.every((material) => material.baseColorTexture), `${candidate.id} has an untextured semantic material`);
  invariant(materials.every((material) => material.normalTexture), `${candidate.id} has a semantic material without normals`);
  invariant(materials.every((material) => !material.emissiveTexture), `${candidate.id} retained a Meshy emissive texture`);
  invariant(materials.every((material) => material.emissiveFactor.every((value) => value === 0)), `${candidate.id} retained emission`);
  invariant(materials.every((material) => material.metallicFactor === 0), `${candidate.id} is not nonmetallic`);
  invariant(materials.every((material) => material.roughnessFactor >= 0.85), `${candidate.id} is too glossy`);
  invariant(triangles <= manifest.generation.maximumOptimizedTriangles, `${candidate.id} exceeds triangle cap`);
  invariant(sourceSplit.barkTriangleShare >= 0.02 && sourceSplit.barkTriangleShare <= 0.2, `${candidate.id} bark split is implausible`);
  invariant(sourceSplit.foliageTriangleShare >= 0.8 && sourceSplit.foliageTriangleShare <= 0.98, `${candidate.id} foliage split is implausible`);
  candidates.push({
    id: candidate.id,
    species: candidate.species,
    path: path.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: statSync(path).size,
    meshes: root.listMeshes().length,
    primitives: root.listMeshes()[0].listPrimitives().length,
    vertices,
    triangles,
    textures: root.listTextures().length,
    dimensionsMetres: dimensions,
    materials,
    semanticSplit: {
      barkTriangles: sourceSplit.barkTriangles,
      foliageTriangles: sourceSplit.foliageTriangles,
      barkTriangleShare: sourceSplit.barkTriangleShare,
      foliageTriangleShare: sourceSplit.foliageTriangleShare,
      greenAtlasPixelShare: sourceSplit.greenAtlasPixelShare,
    },
  });
}

invariant(state.totalConsumedCredits === manifest.budget.maximumCredits, `Recorded ${state.totalConsumedCredits} credits; expected exact capped spend ${manifest.budget.maximumCredits}`);
const meshy = {
  balanceBeforeLatestRun: state.balanceBeforeLatestRun,
  balanceAfterLatestRun: state.balanceAfterLatestRun,
  totalConsumedCredits: state.totalConsumedCredits,
  tasks: Object.fromEntries(
    Object.entries(state.candidates).map(([id, task]) => [id, {
      previewTaskId: task.previewTaskId,
      previewConsumedCredits: task.previewConsumedCredits,
      refineTaskId: task.refineTaskId ?? null,
      refineConsumedCredits: task.refineConsumedCredits ?? 0,
      previewStatus: task.previewStatus,
      refineStatus: task.refineStatus ?? null,
    }])
  ),
};
const metrics = { contractVersion: manifest.version, familyId: manifest.familyId, candidates, meshy };
const output = resolve(manifest.evidenceDirectory, "semantic-family-metrics.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
