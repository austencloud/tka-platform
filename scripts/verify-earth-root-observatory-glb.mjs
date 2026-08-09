#!/usr/bin/env node
/** Verify the Earth Root Observatory GLB and its generated Gate 2 evidence. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve(
  "static/models/museum/cave/earth-root-observatory-graybox.glb"
);
const manifestPath = resolve(
  "docs/superpowers/specs/earth-root-observatory/earth-root-observatory-gate2-blender-plan.json"
);
const reportPath = resolve(
  "docs/superpowers/specs/earth-root-observatory/earth-root-observatory-gate2-report.json"
);
const contactSheetPath = resolve(
  "docs/superpowers/specs/earth-root-observatory/earth-root-observatory-gate2-contact-sheet.png"
);
const blendPath = resolve("blender/earth-root-observatory-graybox.blend");
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
const nodes = gltf.nodes ?? [];
const nodeNames = nodes.map((node) => node.name ?? "");
const leakedNodes = nodeNames.filter((name) => /^(QA_|LOC_|REF_)/.test(name));
const bakedAvatarNodes = nodeNames.filter((name) =>
  /^ER_Performer_[GHI]_(Torso|Head|Leg|Arm|Staff)/.test(name)
);
const extensions = new Set(gltf.extensionsUsed ?? []);
const lightCount = gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
const requiredNodes = [
  "ER_Hero_Tree_Trunk",
  "ER_Performer_G_Stage",
  "ER_Performer_H_Stage",
  "ER_Performer_I_Stage",
  "ER_Interaction_G",
  "ER_Interaction_H",
  "ER_Interaction_I",
  "ER_Recognition_Zone",
  "ER_Recognition_Platform",
  "ER_Recognition_Guide_G",
  "ER_Recognition_Guide_H",
  "ER_Recognition_Guide_I",
  "ER_Fire_Threshold_Cue",
  "ER_Air_Threshold_Cue",
];
const missingNodes = requiredNodes.filter((name) => !nodeNames.includes(name));
const routeSegments = nodeNames.filter((name) =>
  name.startsWith("ER_Route_Segment_")
);
const performerNodes = nodes.filter((node) =>
  /^ER_Performer_[GHI]_Stage$/.test(node.name ?? "")
);
const sequenceIds = performerNodes
  .map((node) => node.extras?.sequenceId)
  .sort();

invariant(bytes <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${bytes}`);
invariant(gltf.scenes?.length === 1, "GLB must contain exactly one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the GLB");
invariant(lightCount === 0, "QA lights leaked into the GLB");
invariant(
  leakedNodes.length === 0,
  `QA nodes leaked: ${leakedNodes.join(", ")}`
);
invariant(
  bakedAvatarNodes.length === 0,
  `Static avatar geometry leaked into the GLB: ${bakedAvatarNodes.join(", ")}`
);
invariant(
  missingNodes.length === 0,
  `Required nodes missing: ${missingNodes.join(", ")}`
);
invariant(
  routeSegments.length === 11,
  `Expected 11 route segments, found ${routeSegments.length}`
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
  JSON.stringify(sequenceIds) ===
    JSON.stringify([
      "cave-earth-seq-g",
      "cave-earth-seq-h",
      "cave-earth-seq-i",
    ]),
  `Sequence extras drifted: ${sequenceIds.join(", ")}`
);
invariant(
  report.sourceDigest === manifest.sourceDigest,
  "Blender report and coordinate manifest digests differ"
);
invariant(
  report.roomFootprint.width === 34 && report.roomFootprint.depth === 24,
  "Blender report no longer carries the approved 34 by 24 metre shell"
);
invariant(
  report.performerCount === 3,
  "Earth performer count drifted from three"
);
invariant(
  report.performerRepresentation === "runtime-avatar",
  "Gate 2 no longer declares the shared runtime avatar representation"
);
invariant(
  report.route.width === 2.4 && report.route.segments === 11,
  "Route width or segment count drifted from the approved plan"
);
invariant(
  report.route.walkingDurationSeconds > 24 &&
    report.route.walkingDurationSeconds < 26,
  "Measured walking duration moved outside the expected 24 to 26 second band"
);
invariant(
  JSON.stringify(report.sequenceFingerprints) ===
    JSON.stringify(manifest.sequenceFingerprints),
  "Sequence fingerprints differ from the generated Blender manifest"
);
invariant(existsSync(blendPath), "Blender source file is missing");
invariant(existsSync(contactSheetPath), "Review contact sheet is missing");

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes,
      blendBytes: statSync(blendPath).size,
      contactSheetBytes: statSync(contactSheetPath).size,
      scenes: gltf.scenes.length,
      nodes: nodes.length,
      meshes: gltf.meshes?.length ?? 0,
      materials: gltf.materials?.length ?? 0,
      cameras: gltf.cameras?.length ?? 0,
      lights: lightCount,
      routeSegments: routeSegments.length,
      sequenceIds,
      sourceDigest: report.sourceDigest,
    },
    null,
    2
  )
);
