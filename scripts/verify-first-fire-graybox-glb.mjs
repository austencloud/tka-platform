#!/usr/bin/env node
/** Verify the review GLB and its generated Blender evidence contract. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve(
  "static/models/museum/cave/first-fire-torch-procession-graybox.glb"
);
const manifestPath = resolve(
  "docs/superpowers/specs/2026-08-06-first-fire-blender-plan.json"
);
const reportPath = resolve("artifacts/first-fire-graybox-report.json");
const maximumBytes = 512 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlbJson(path) {
  const buffer = readFileSync(path);
  invariant(buffer.length >= 20, "GLB is too short to contain a valid header");
  invariant(buffer.readUInt32LE(0) === 0x46546c67, "GLB magic is invalid");
  invariant(buffer.readUInt32LE(4) === 2, "GLB must use glTF 2.0");
  invariant(
    buffer.readUInt32LE(8) === buffer.length,
    "GLB header length does not match the file"
  );
  const jsonLength = buffer.readUInt32LE(12);
  return {
    bytes: buffer.length,
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")),
  };
}

const { bytes, json: gltf } = readGlbJson(glbPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const extensions = new Set(gltf.extensionsUsed ?? []);
const instancedNodes = (gltf.nodes ?? []).filter(
  (node) => node.extensions?.EXT_mesh_gpu_instancing
);
const instanceCounts = instancedNodes
  .map((node) => {
    const accessorIndex =
      node.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION;
    return gltf.accessors?.[accessorIndex]?.count;
  })
  .sort((left, right) => left - right);
const leakedNodes = (gltf.nodes ?? [])
  .map((node) => node.name ?? "")
  .filter((name) => /^(QA_|LOC_|REF_)/.test(name));
const lightCount = gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0;

invariant(bytes <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${bytes}`);
invariant(gltf.scenes?.length === 1, "GLB must contain exactly one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the GLB");
invariant(lightCount === 0, "QA lights leaked into the GLB");
invariant(
  leakedNodes.length === 0,
  `QA nodes leaked: ${leakedNodes.join(", ")}`
);
invariant(
  extensions.has("EXT_mesh_gpu_instancing"),
  "Torch guides lost GPU instancing"
);
invariant(
  extensions.has("KHR_draco_mesh_compression"),
  "GLB lost Draco compression"
);
invariant(
  JSON.stringify(instanceCounts) === JSON.stringify([38, 38, 50, 126]),
  `Unexpected instance batches: ${instanceCounts.join(", ")}`
);
invariant(
  (gltf.materials?.length ?? 0) <= 20,
  `Material budget exceeded: ${gltf.materials?.length ?? 0}`
);
invariant(
  report.sourceDigest === manifest.sourceDigest,
  "Blender report and coordinate manifest digests differ"
);
invariant(
  report.roomFootprint.width === 60 && report.roomFootprint.depth === 30,
  "Blender report no longer carries the 60 by 30 metre footprint"
);
invariant(report.fieldTorchStems === 72, "Field torch count drifted from 72");
invariant(
  report.perimeterTorchStems === 54,
  "Perimeter torch count drifted from 54"
);

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes,
      scenes: gltf.scenes.length,
      nodes: gltf.nodes?.length ?? 0,
      meshes: gltf.meshes?.length ?? 0,
      materials: gltf.materials?.length ?? 0,
      cameras: gltf.cameras?.length ?? 0,
      lights: lightCount,
      extensions: [...extensions],
      instanceCounts,
      sourceDigest: report.sourceDigest,
    },
    null,
    2
  )
);
