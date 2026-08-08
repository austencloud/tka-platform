#!/usr/bin/env node
/** Verify the Earth Root Chasm GLB and generated Blender evidence contract. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve(
  "static/models/museum/cave/earth-root-chasm-graybox.glb"
);
const manifestPath = resolve(
  "docs/superpowers/specs/2026-08-08-earth-root-chasm-blender-plan.json"
);
const reportPath = resolve("artifacts/earth-root-chasm-graybox-report.json");
const maximumBytes = 2 * 1024 * 1024;

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
const nodeNames = (gltf.nodes ?? []).map((node) => node.name ?? "");
const leakedNodes = nodeNames.filter((name) => /^(QA_|LOC_|REF_)/.test(name));
const lightCount = gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
const requiredNodes = [
  "EC_Boss_G",
  "EC_Boss_H",
  "EC_Boss_I",
  "EC_Performer_G_Torso",
  "EC_Performer_H_Torso",
  "EC_Performer_I_Torso",
  "EC_Station_G_Label",
  "EC_Station_H_Label",
  "EC_Station_I_Label",
];
const missingNodes = requiredNodes.filter((name) => !nodeNames.includes(name));

invariant(bytes <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${bytes}`);
invariant(gltf.scenes?.length === 1, "GLB must contain exactly one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the GLB");
invariant(lightCount === 0, "QA lights leaked into the GLB");
invariant(
  leakedNodes.length === 0,
  `QA nodes leaked: ${leakedNodes.join(", ")}`
);
invariant(
  missingNodes.length === 0,
  `Earth ensemble nodes missing: ${missingNodes.join(", ")}`
);
invariant(
  extensions.has("KHR_draco_mesh_compression"),
  "GLB lost Draco compression"
);
invariant(
  (gltf.materials?.length ?? 0) <= 16,
  `Material budget exceeded: ${gltf.materials?.length ?? 0}`
);
invariant(
  report.sourceDigest === manifest.sourceDigest,
  "Blender report and coordinate manifest digests differ"
);
invariant(
  report.roomFootprint.width === 34 && report.roomFootprint.depth === 24,
  "Blender report no longer carries the compiled 34 by 24 metre footprint"
);
invariant(
  report.performerStations === 3,
  "Earth performer count drifted from three"
);
invariant(
  JSON.stringify(report.performerIds) ===
    JSON.stringify([
      "cave-earth-automaton-g",
      "cave-earth-automaton-h",
      "cave-earth-automaton-i",
    ]),
  "Earth performer identities drifted from G/H/I"
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
      performerStations: report.performerStations,
      performerIds: report.performerIds,
      sourceDigest: report.sourceDigest,
    },
    null,
    2
  )
);
