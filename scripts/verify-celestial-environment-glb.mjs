#!/usr/bin/env node
/** Verify the production Seraphic Vault GLB contract. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve("static/models/celestial/celestial-environment.glb");
const rawGlbPath = resolve(
  "static/models/celestial/celestial-environment_raw.glb"
);
const maximumBytes = 14 * 1024 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlbJson(path) {
  const buffer = readFileSync(path);
  invariant(
    buffer.length >= 20,
    `${path} is too short to contain a GLB header`
  );
  invariant(
    buffer.readUInt32LE(0) === 0x46546c67,
    `${path} has invalid GLB magic`
  );
  invariant(buffer.readUInt32LE(4) === 2, `${path} must use glTF 2.0`);
  invariant(
    buffer.readUInt32LE(8) === buffer.length,
    `${path} has an invalid length`
  );
  const jsonLength = buffer.readUInt32LE(12);
  return {
    bytes: buffer.length,
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")),
  };
}

const { bytes, json: gltf } = readGlbJson(glbPath);
const { json: rawGltf } = readGlbJson(rawGlbPath);
const extensions = new Set(gltf.extensionsUsed ?? []);
const nodeNames = (gltf.nodes ?? []).map((node) => node.name ?? "");
const rawNodes = rawGltf.nodes ?? [];
const rawSemanticNodes = rawNodes.filter((node) => node.extras);
const leakedNodes = nodeNames.filter((name) =>
  /^(QA_|AssetSource_)/.test(name)
);
const lightCount = gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
const ribNodes = rawSemanticNodes.filter(
  (node) => node.extras.tka_role === "feather-rib"
);
const floorNodes = rawSemanticNodes.filter(
  (node) => node.extras.tka_role === "performance-floor"
);
const fragmentNodes = rawSemanticNodes.filter(
  (node) => node.extras.tka_role === "stage-fragment"
);
const instanceNodes = (gltf.nodes ?? []).filter(
  (node) => node.extensions?.EXT_mesh_gpu_instancing
);
const floorMaterial = (gltf.materials ?? []).find(
  (material) => material.name === "AlabasterPerformanceFloor"
);
const edgeMaterial = (gltf.materials ?? []).find(
  (material) => material.name === "AlabasterBrokenEdges"
);
const instanceCounts = instanceNodes.map((node) => {
  const accessor =
    node.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION;
  return gltf.accessors?.[accessor]?.count ?? 0;
});

invariant(
  bytes <= maximumBytes,
  `Celestial GLB exceeds ${maximumBytes} bytes: ${bytes}`
);
invariant(gltf.scenes?.length === 1, "Celestial GLB must contain one scene");
invariant(
  (gltf.cameras?.length ?? 0) === 0,
  "QA cameras leaked into Celestial GLB"
);
invariant(lightCount === 0, "QA lights leaked into Celestial GLB");
invariant(
  leakedNodes.length === 0,
  `QA nodes leaked: ${leakedNodes.join(", ")}`
);
invariant(
  extensions.has("EXT_meshopt_compression"),
  "Celestial GLB lost meshopt compression"
);
invariant(
  extensions.has("KHR_texture_basisu"),
  "Celestial textures are not KTX2 encoded"
);
invariant(
  extensions.has("EXT_mesh_gpu_instancing"),
  "Celestial rib pairs lost GPU instancing"
);
invariant(
  Number.isInteger(
    floorMaterial?.pbrMetallicRoughness?.baseColorTexture?.index
  ),
  "Celestial performance floor lost its travertine color map"
);
invariant(
  Number.isInteger(edgeMaterial?.pbrMetallicRoughness?.baseColorTexture?.index),
  "Celestial stage fragments lost their stone color map"
);
invariant(
  ribNodes.length === 6,
  `Expected six feather ribs, found ${ribNodes.length}`
);
invariant(
  floorNodes.length === 1,
  `Expected one performance floor, found ${floorNodes.length}`
);
invariant(
  fragmentNodes.length === 3,
  `Expected three stage fragments, found ${fragmentNodes.length}`
);
invariant(
  Number(floorNodes[0].extras.tka_surface_y) === 0.01,
  "Celestial surface height changed"
);
invariant(
  Number(floorNodes[0].extras.tka_performance_clear_radius) >= 5.5,
  "Celestial performance lane is too small"
);

const families = Object.groupBy(ribNodes, (node) => node.extras.tka_family);
for (const family of ["outer", "middle", "inner"]) {
  const members = families[family] ?? [];
  invariant(
    members.length === 2,
    `Expected a mirrored ${family} pair, found ${members.length}`
  );
  invariant(
    new Set(members.map((node) => node.extras.tka_side)).size === 2,
    `${family} pair lost left/right ownership`
  );
}
invariant(
  instanceCounts.filter((count) => count === 2).length >= 3,
  `Expected three two-rib GPU batches, found ${instanceCounts.join(", ")}`
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
      textures: gltf.textures?.length ?? 0,
      extensions: [...extensions],
      featherRibs: {
        total: ribNodes.length,
        families: Object.fromEntries(
          Object.entries(families).map(([family, members]) => [
            family,
            members.length,
          ])
        ),
        instanceCounts,
      },
      stage: {
        surfaceY: Number(floorNodes[0].extras.tka_surface_y),
        clearRadius: Number(floorNodes[0].extras.tka_performance_clear_radius),
        fragments: fragmentNodes.length,
        textured: true,
      },
    },
    null,
    2
  )
);
