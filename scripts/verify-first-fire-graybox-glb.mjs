#!/usr/bin/env node
/** Verify the Cinder Court GLB and deterministic Blender evidence contract. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve(
  "static/models/museum/cave/first-fire-cinder-court-graybox.glb"
);
const manifestPath = resolve(
  "docs/superpowers/specs/first-fire-cinder-court/first-fire-cinder-court-blender-plan.json"
);
const reportPath = resolve(
  "artifacts/first-fire-cinder-court/first-fire-cinder-court-graybox-report.json"
);
const maximumBytes = 1536 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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
    buffer,
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")),
  };
}

const { buffer, json: gltf } = readGlbJson(glbPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const extensions = new Set(gltf.extensionsUsed ?? []);
const nodeNames = (gltf.nodes ?? []).map((node) => node.name ?? "");
const leakedNodes = nodeNames.filter((name) => /^(QA_|LOC_|REF_)/.test(name));
const staleNodes = nodeNames.filter((name) => /TorchProcession|EmberBridge/i.test(name));
const coneNodes = nodeNames.filter((name) => /Flame.*Cone|Cone.*Flame/i.test(name));
const lightCount = gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
const instancedNodes = (gltf.nodes ?? []).filter(
  (node) => node.extensions?.EXT_mesh_gpu_instancing
);
const instanceCounts = instancedNodes
  .map((node) => {
    const accessorIndex =
      node.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION;
    return gltf.accessors?.[accessorIndex]?.count ?? 0;
  })
  .sort((left, right) => left - right);
const totalInstances = instanceCounts.reduce((sum, count) => sum + count, 0);

invariant(buffer.length <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${buffer.length}`);
invariant(gltf.scenes?.length === 1, "GLB must contain exactly one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the GLB");
invariant(lightCount === 0, "QA lights leaked into the GLB");
invariant(leakedNodes.length === 0, `QA nodes leaked: ${leakedNodes.join(", ")}`);
invariant(staleNodes.length === 0, `Stale S-procession nodes leaked: ${staleNodes.join(", ")}`);
invariant(coneNodes.length === 0, `Triangular cone flame guides leaked: ${coneNodes.join(", ")}`);
invariant(
  extensions.has("KHR_draco_mesh_compression"),
  "GLB lost Draco compression"
);
invariant(
  extensions.has("EXT_mesh_gpu_instancing"),
  "Repeated torch/flame geometry lost GPU instancing"
);
invariant(totalInstances >= 126, `Expected at least 126 instanced objects, got ${totalInstances}`);
invariant(
  (gltf.materials?.length ?? 0) <= 20,
  `Material budget exceeded: ${gltf.materials?.length ?? 0}`
);
invariant(manifest.contract.schemaVersion === 2, "Manifest is not schema v2");
invariant(
  manifest.contract.sceneName === "First Fire Cinder Court Graybox",
  "Manifest scene name is stale"
);
invariant(
  report.sourceDigest === manifest.sourceDigest,
  "Blender report and coordinate manifest digests differ"
);
invariant(
  report.roomFootprint.width === 58 && report.roomFootprint.depth === 44,
  "Blender report no longer carries the 58 by 44 metre footprint"
);
invariant(report.counts.courts === 3, "Cinder Court must contain three courts");
invariant(
  report.counts.basaltMasses === manifest.contract.basalt.length,
  "Blender basalt count drifted from the coordinate manifest"
);
// The shell is carved out of one mass, not stacked out of prisms. A returning
// FF_Basalt_ node means the build regressed to free-standing interior walls
// standing on a slab, which is what reopened Gate 2.
invariant(
  report.shell?.model === "carved",
  "Blender report no longer describes a carved shell"
);
invariant(
  nodeNames.filter((name) => /^FF_Shell_Rock$/.test(name)).length === 1,
  "The carved shell mass FF_Shell_Rock is missing from the GLB"
);
invariant(
  nodeNames.filter((name) => /^FF_Basalt_/.test(name)).length === 0,
  "Stacked basalt prisms returned to the shell"
);
invariant(
  report.counts.basaltMassesBuiltAsGeometry === 0,
  "Blender report claims basalt masses were built as standalone geometry"
);
// Everything green must carry the FF_Growth prefix the runtime stages, or the
// Earth route renders from the moment the room loads and the reveal is spent
// while the visitor is still standing at the third performer.
const greenLeaks = nodeNames.filter(
  (name) => /growth-path/i.test(name) && !/^FF_Growth/i.test(name)
);
invariant(
  greenLeaks.length === 0,
  `Green Earth geometry outside the staged FF_Growth prefix: ${greenLeaks.join(", ")}`
);
invariant(
  nodeNames.some((name) => /^FF_Growth_Route_/i.test(name)),
  "The staged green Earth route is missing from the graybox"
);

invariant(report.counts.laneFlames === 24, "Lane flame count drifted from 24");
invariant(report.counts.perimeterFlames === 36, "Court perimeter count drifted from 36");
invariant(report.counts.totalFlameAnchors === 60, "Total flame anchors drifted from 60");
invariant(
  report.counts.maximumDetailedShrines === 1,
  "Detailed hero fire budget must remain one"
);

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes: buffer.length,
      sha256: sha256(buffer),
      scenes: gltf.scenes.length,
      nodes: gltf.nodes?.length ?? 0,
      meshes: gltf.meshes?.length ?? 0,
      materials: gltf.materials?.length ?? 0,
      cameras: gltf.cameras?.length ?? 0,
      lights: lightCount,
      extensions: [...extensions],
      instanceCounts,
      totalInstances,
      sourceDigest: report.sourceDigest,
      room: report.roomFootprint,
      counts: report.counts,
    },
    null,
    2
  )
);
