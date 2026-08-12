#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Matrix4, Quaternion, Vector3 } from "three";

const RAW_GLB = resolve("static/models/winter/winter-environment_raw.glb");
const OPTIMIZED_GLB = resolve("static/models/winter/winter-environment.glb");
const OUTPUT = resolve("scripts/winter-composer-instance-map.json");

const EDITABLE_ROLES = new Set([
  "conifer",
  "rock",
  "deadwood",
  "stump",
  "settlement-seat",
  "settlement-hearth-stone",
  "settlement-hearth-fuel",
  "settlement-hearth-ember",
  "lodge-woodpile-log",
]);

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

function normalizedName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function matrixKey(matrix) {
  let hash = 2166136261;
  for (const value of matrix.elements) {
    const text = value.toFixed(4);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(36);
}

function descriptorForNode(node) {
  const extras = node.getExtras();
  const role =
    typeof extras.tka_role === "string" ? extras.tka_role : undefined;
  if (!role) return null;
  const name = node.getName();
  return {
    role,
    descriptor: {
      id:
        typeof extras.tka_composer_id === "string"
          ? extras.tka_composer_id
          : `winter:${normalizedName(role)}:${normalizedName(name)}`,
      objectKey:
        typeof extras.tka_composer_object_key === "string"
          ? extras.tka_composer_object_key
          : normalizedName(role),
      label: name || role,
      locked:
        typeof extras.tka_composer_locked === "boolean"
          ? extras.tka_composer_locked
          : !EDITABLE_ROLES.has(role),
    },
  };
}

function matrixFromNode(node) {
  return new Matrix4().compose(
    new Vector3(...node.getWorldTranslation()),
    new Quaternion(...node.getWorldRotation()),
    new Vector3(...node.getWorldScale())
  );
}

function instanceMatrix(node, batch, index) {
  const translation = [0, 0, 0];
  const rotation = [0, 0, 0, 1];
  const scale = [1, 1, 1];
  batch.getAttribute("TRANSLATION")?.getElement(index, translation);
  batch.getAttribute("ROTATION")?.getElement(index, rotation);
  batch.getAttribute("SCALE")?.getElement(index, scale);
  const localMatrix = new Matrix4().compose(
    new Vector3(...translation),
    new Quaternion(...rotation),
    new Vector3(...scale)
  );
  return new Matrix4().fromArray(node.getWorldMatrix()).multiply(localMatrix);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const [rawBytes, optimizedBytes, rawDocument, optimizedDocument] =
  await Promise.all([
    readFile(RAW_GLB),
    readFile(OPTIMIZED_GLB),
    io.read(RAW_GLB),
    io.read(OPTIMIZED_GLB),
  ]);

const rawDescriptorsByMesh = new Map();
for (const node of rawDocument.getRoot().listNodes()) {
  const authored = descriptorForNode(node);
  const mesh = node.getMesh();
  if (!authored || !mesh) continue;
  const nodeMatrix = matrixFromNode(node);
  const samples = rawDescriptorsByMesh.get(mesh.getName()) ?? [];
  samples.push({
    descriptor: authored.descriptor,
    role: authored.role,
    position: new Vector3().setFromMatrixPosition(nodeMatrix),
  });
  rawDescriptorsByMesh.set(mesh.getName(), samples);
}

const instancesByMatrixKey = {};
let optimizedInstanceCount = 0;
let matchedInstanceCount = 0;
for (const node of optimizedDocument.getRoot().listNodes()) {
  const batch = node.getExtension("EXT_mesh_gpu_instancing");
  if (!batch) continue;
  const firstAttribute = batch.listAttributes()[0];
  const count = firstAttribute?.getCount() ?? 0;
  const meshName = node.getMesh()?.getName() ?? "";
  const rawSamples = rawDescriptorsByMesh.get(meshName) ?? [];
  const optimizedSamples = [];
  for (let index = 0; index < count; index += 1) {
    optimizedInstanceCount += 1;
    const optimizedMatrix = instanceMatrix(node, batch, index);
    optimizedSamples.push({
      key: matrixKey(optimizedMatrix),
      position: new Vector3().setFromMatrixPosition(optimizedMatrix),
    });
  }

  const candidates = [];
  for (
    let optimizedIndex = 0;
    optimizedIndex < optimizedSamples.length;
    optimizedIndex += 1
  ) {
    for (let rawIndex = 0; rawIndex < rawSamples.length; rawIndex += 1) {
      candidates.push({
        optimizedIndex,
        rawIndex,
        distance: optimizedSamples[optimizedIndex].position.distanceTo(
          rawSamples[rawIndex].position
        ),
      });
    }
  }
  candidates.sort((left, right) => left.distance - right.distance);
  const usedOptimized = new Set();
  const usedRaw = new Set();
  for (const candidate of candidates) {
    if (candidate.distance > 4) break;
    if (
      usedOptimized.has(candidate.optimizedIndex) ||
      usedRaw.has(candidate.rawIndex)
    ) {
      continue;
    }
    usedOptimized.add(candidate.optimizedIndex);
    usedRaw.add(candidate.rawIndex);
    const optimized = optimizedSamples[candidate.optimizedIndex];
    const raw = rawSamples[candidate.rawIndex];
    instancesByMatrixKey[optimized.key] = raw.descriptor;
    matchedInstanceCount += 1;
  }
}

const expectedTreeCount = [...rawDescriptorsByMesh.values()]
  .flat()
  .filter((sample) => sample.role === "conifer").length;
const mappedTreeCount = Object.values(instancesByMatrixKey).filter(
  (descriptor) => descriptor.id.startsWith("winter:conifer:")
).length;
if (mappedTreeCount !== expectedTreeCount) {
  throw new Error(
    `Mapped ${mappedTreeCount}/${expectedTreeCount} Winter tree instances`
  );
}

const manifest = {
  version: 1,
  rawGlbSha256: sha256(rawBytes),
  optimizedGlbSha256: sha256(optimizedBytes),
  optimizedInstanceCount,
  matchedInstanceCount,
  mappedTreeCount,
  instancesByMatrixKey,
};
await writeFile(OUTPUT, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  `Mapped ${matchedInstanceCount}/${optimizedInstanceCount} instances, including ${mappedTreeCount} trees`
);
