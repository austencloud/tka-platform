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

const manifest = JSON.parse(await readFile(resolve("scripts/forest-semantic-tree-wave-r2.json"), "utf8"));
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

invariant(manifest.candidates.length === 6, `Expected six accepted candidates, found ${manifest.candidates.length}`);
invariant(state.totalConsumedCredits === manifest.budget.expectedConsumedCredits, `Recorded ${state.totalConsumedCredits} credits; expected ${manifest.budget.expectedConsumedCredits}`);
invariant(state.totalConsumedCredits <= manifest.budget.maximumCredits, `Spent ${state.totalConsumedCredits} credits; cap is ${manifest.budget.maximumCredits}`);

const acceptedIds = new Set(manifest.candidates.map((candidate) => candidate.id));
const stateEntries = Object.entries(state.candidates);
const previewCredits = stateEntries.reduce((total, [, task]) => total + (task.previewConsumedCredits ?? 0), 0);
const refineCredits = stateEntries.reduce((total, [, task]) => total + (task.refineConsumedCredits ?? 0), 0);
invariant(previewCredits + refineCredits === state.totalConsumedCredits, "Task credit sum disagrees with state total");
invariant(previewCredits === 260, `Expected 260 preview credits, recorded ${previewCredits}`);
invariant(refineCredits === 60, `Expected 60 refinement credits, recorded ${refineCredits}`);
invariant(stateEntries.filter(([, task]) => task.previewTaskId).length === 13, "Expected thirteen preview task IDs");
invariant(stateEntries.filter(([, task]) => task.refineTaskId).length === 6, "Expected six refinement task IDs");
for (const candidate of manifest.candidates) {
  const task = state.candidates[candidate.id];
  invariant(task?.previewStatus === "SUCCEEDED", `${candidate.id} preview was not successful`);
  invariant(task?.refineStatus === "SUCCEEDED", `${candidate.id} refinement was not successful`);
}
for (const rejected of manifest.rejectedPreviews) {
  invariant(state.candidates[rejected.id]?.previewStatus === "SUCCEEDED", `${rejected.id} rejection lacks a completed preview`);
  invariant(!acceptedIds.has(rejected.id), `${rejected.id} is both accepted and rejected`);
}

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
  }));
  const sourceSplit = splitMetrics.find((entry) => entry.id === candidate.id);
  invariant(sourceSplit, `${candidate.id} has no semantic split metrics`);
  invariant(root.listMeshes().length === 1, `${candidate.id} expected one mesh`);
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
  invariant(sourceSplit.barkTriangleShare >= 0.015 && sourceSplit.barkTriangleShare <= 0.2, `${candidate.id} bark split is implausible`);
  invariant(sourceSplit.foliageTriangleShare >= 0.8 && sourceSplit.foliageTriangleShare <= 0.985, `${candidate.id} foliage split is implausible`);
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

const tasks = Object.fromEntries(stateEntries.map(([id, task]) => [id, {
  species: task.species,
  accepted: acceptedIds.has(id),
  previewTaskId: task.previewTaskId,
  previewConsumedCredits: task.previewConsumedCredits,
  previewStatus: task.previewStatus,
  refineTaskId: task.refineTaskId ?? null,
  refineConsumedCredits: task.refineConsumedCredits ?? 0,
  refineStatus: task.refineStatus ?? null,
}]));
const metrics = {
  contractVersion: manifest.version,
  familyId: manifest.familyId,
  candidates,
  meshy: {
    inferredBalanceAtWaveStart: state.balanceAfterLatestRun + state.totalConsumedCredits,
    balanceAfterWave: state.balanceAfterLatestRun,
    previewCredits,
    refineCredits,
    totalConsumedCredits: state.totalConsumedCredits,
    maximumCredits: manifest.budget.maximumCredits,
    tasks,
  },
};
const output = resolve(manifest.evidenceDirectory, "semantic-wave-r2-metrics.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
