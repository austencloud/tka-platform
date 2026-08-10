#!/usr/bin/env node

import { realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-tree-regeneration.json"), "utf8")
);
const candidate = manifest.candidate;
const state = JSON.parse(await readFile(resolve(manifest.statePath), "utf8"));
const renderMetrics = JSON.parse(
  await readFile(
    resolve(
      manifest.evidenceDirectory,
      "forest-tree-regeneration-final-render-metrics.json"
    ),
    "utf8"
  )
);
const path = resolve(manifest.outputDirectory, `${candidate.id}.glb`);
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

const bytes = await readFile(path);
invariant(bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "glTF", "Candidate is not a GLB");
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
const materials = root.listMaterials();
const textures = root.listTextures();
const materialFacts = materials.map((material) => ({
  name: material.getName(),
  baseColorTexture: Boolean(material.getBaseColorTexture()),
  normalTexture: Boolean(material.getNormalTexture()),
  metallicRoughnessTexture: Boolean(material.getMetallicRoughnessTexture()),
  metallicFactor: material.getMetallicFactor(),
  roughnessFactor: material.getRoughnessFactor(),
  alphaMode: material.getAlphaMode(),
  doubleSided: material.getDoubleSided(),
}));

invariant(triangles > 0, "Candidate has no triangles");
invariant(triangles <= candidate.maximumOptimizedTriangles, `Candidate has ${triangles} triangles; maximum is ${candidate.maximumOptimizedTriangles}`);
invariant(materials.length > 0, "Candidate has no materials");
invariant(textures.length >= 3, `Candidate has ${textures.length} textures; expected PBR maps`);
invariant(materialFacts.some((material) => material.baseColorTexture), "Candidate has no base-color texture");
invariant(materialFacts.some((material) => material.normalTexture), "Candidate has no normal texture");
invariant(materialFacts.some((material) => material.metallicRoughnessTexture), "Candidate has no metallic-roughness texture");
invariant(materialFacts.every((material) => material.metallicFactor <= 0.05), "Candidate is not nonmetallic");
invariant(materialFacts.every((material) => material.roughnessFactor >= 0.7), "Candidate material roughness is too low");
invariant(state.totalProjectCredits <= manifest.cost.maximumCredits, "Candidate exceeded Meshy credit cap");

const metrics = {
  contractVersion: manifest.version,
  candidate: {
    id: candidate.id,
    label: candidate.label,
    path: path.replaceAll("\\", "/"),
    bytes: statSync(path).size,
    meshes: root.listMeshes().length,
    primitives: root.listMeshes().reduce((count, mesh) => count + mesh.listPrimitives().length, 0),
    vertices,
    triangles,
    materials: materials.length,
    textures: textures.length,
    normalizedDimensionsMetres: renderMetrics.normalizedDimensionsMetres,
    reviewHeightMetres: renderMetrics.reviewHeightMetres,
    materialFacts,
  },
  meshy: {
    previewTaskId: state.previewTaskId,
    refineTaskId: state.refineTaskId,
    previewConsumedCredits: state.previewConsumedCredits,
    refineConsumedCredits: state.refineConsumedCredits,
    totalConsumedCredits: state.totalConsumedCredits,
    priorDiagnosticCredits: state.priorDiagnosticCredits,
    totalProjectCredits: state.totalProjectCredits,
    balanceBeforeLatestRun: state.balanceBeforeLatestRun,
    balanceAfterLatestRun: state.balanceAfterLatestRun,
  },
};
const evidencePath = resolve(manifest.evidenceDirectory, "forest-tree-regeneration-metrics.json");
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
