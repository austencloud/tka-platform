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

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-speedtree-pilot.json"), "utf8")
);
const requireFromCli = createRequire(
  realpathSync(resolve("node_modules/@gltf-transform/cli/package.json"))
);
const [{ NodeIO, getBounds }, { ALL_EXTENSIONS }, { MeshoptDecoder }] =
  await Promise.all([
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/core"))),
    import(pathToFileURL(requireFromCli.resolve("@gltf-transform/extensions"))),
    import(pathToFileURL(requireFromCli.resolve("meshoptimizer"))),
  ]);
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

async function inspectAsset(path) {
  const bytes = await readFile(path);
  invariant(
    bytes.subarray(0, 4).toString("ascii") === "glTF",
    `${path} is not a GLB`
  );
  const document = await io.read(path);
  const root = document.getRoot();
  let triangles = 0;
  let vertices = 0;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position) continue;
      vertices += position.getCount();
      triangles +=
        (primitive.getIndices()?.getCount() ?? position.getCount()) / 3;
    }
  }
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  invariant(scene, `${path} has no scene`);
  const bounds = getBounds(scene);
  const minimum = [...bounds.min];
  const maximum = [...bounds.max];
  return {
    path: path.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: statSync(path).size,
    meshes: root.listMeshes().length,
    primitives: root
      .listMeshes()
      .reduce((total, mesh) => total + mesh.listPrimitives().length, 0),
    vertices,
    triangles,
    textures: root.listTextures().length,
    minimum,
    maximum,
    dimensions: maximum.map((value, axis) => value - minimum[axis]),
    materials: root.listMaterials().map((material) => ({
      name: material.getName(),
      alphaMode: material.getAlphaMode(),
      alphaCutoff: material.getAlphaCutoff(),
      doubleSided: material.getDoubleSided(),
      metallicFactor: material.getMetallicFactor(),
      roughnessFactor: material.getRoughnessFactor(),
      baseColorTexture: material.getBaseColorTexture()?.getName() ?? null,
      normalTexture: material.getNormalTexture()?.getName() ?? null,
    })),
  };
}

const candidatePath = resolve(manifest.candidate.runtimePath);
const meshyPath = resolve(manifest.comparison.meshyRuntimePath);
const [candidate, meshy] = await Promise.all([
  inspectAsset(candidatePath),
  inspectAsset(meshyPath),
]);

const expectedNames = [
  "ForestOak_CutWood",
  "ForestOak_Bark",
  "ForestOak_Foliage_Outer",
  "ForestOak_Foliage_Inner",
];
const candidateNames = candidate.materials.map((material) => material.name);
invariant(
  candidate.meshes === 1,
  `Candidate has ${candidate.meshes} meshes; expected one instancing prototype`
);
invariant(
  candidate.primitives === 4,
  `Candidate has ${candidate.primitives} primitives; expected four semantic surfaces`
);
invariant(
  candidate.triangles <= manifest.candidate.maximumTriangles,
  `Candidate has ${candidate.triangles} triangles`
);
invariant(
  candidate.bytes <= manifest.candidate.maximumBytes,
  `Candidate is ${candidate.bytes} bytes`
);
invariant(
  Math.abs(candidate.dimensions[1] - manifest.candidate.targetHeightMetres) <=
    0.02,
  `Candidate height is ${candidate.dimensions[1]} m`
);
invariant(
  expectedNames.every((name) => candidateNames.includes(name)),
  `Missing semantic materials: ${expectedNames.filter((name) => !candidateNames.includes(name)).join(", ")}`
);
invariant(
  candidate.materials
    .filter((material) => material.name.includes("Foliage"))
    .every((material) => material.alphaMode === "MASK" && material.doubleSided),
  "Foliage must use two-sided alpha masking"
);
invariant(
  candidate.materials
    .filter((material) => !material.name.includes("Foliage"))
    .every(
      (material) => material.alphaMode === "OPAQUE" && !material.doubleSided
    ),
  "Wood surfaces must remain opaque and single-sided"
);
invariant(
  candidate.materials.every(
    (material) =>
      material.metallicFactor === 0 && material.roughnessFactor >= 0.8
  ),
  "Tree materials must be matte and nonmetallic"
);
invariant(
  manifest.source.commercialUseAllowed === false &&
    manifest.candidate.runtimePath.includes("evaluation-only"),
  "Noncommercial source escaped the evaluation-only boundary"
);
invariant(
  manifest.candidate.runtimePath !== manifest.comparison.meshyRuntimePath,
  "Pilot overwrote the production oak"
);

const metrics = {
  contractVersion: manifest.version,
  source: manifest.source,
  verdictBoundary: {
    visualAndTechnicalEvaluationAllowed: true,
    productionPromotionAllowed: false,
    reason: "The ORCA control source is CC BY-NC-SA 3.0.",
  },
  candidate,
  currentMeshyProduction: meshy,
  deltas: {
    triangles: candidate.triangles - meshy.triangles,
    bytes: candidate.bytes - meshy.bytes,
    materials: candidate.materials.length - meshy.materials.length,
    semanticSurfaceCount: `${meshy.materials.length} -> ${candidate.materials.length}`,
  },
};
const evidencePath = resolve(
  manifest.evidenceDirectory,
  "speedtree-pilot-runtime-metrics.json"
);
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify(metrics, null, 2));
