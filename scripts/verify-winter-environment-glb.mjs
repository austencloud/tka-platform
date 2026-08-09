#!/usr/bin/env node
/** Verify the production Moonlit Winter Hollow GLB contract. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve("static/models/winter/winter-environment.glb");
const rawGlbPath = resolve("static/models/winter/winter-environment_raw.glb");
const maximumBytes = 20 * 1024 * 1024;

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
    "GLB header length is invalid"
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
const rawNodeNames = rawNodes.map((node) => node.name ?? "");
const semanticNodes = rawNodes.filter((node) => node.extras);
const leakedNodes = nodeNames.filter((name) =>
  /^(QA_|AssetSource_)/.test(name)
);
const forbiddenAuthoredNodes = rawNodeNames.filter((name) =>
  /(Moon|Ridge|PrimitiveBoulder|CylinderLog)/i.test(name)
);
const conifers = semanticNodes.filter(
  (node) => node.extras.tka_role === "conifer"
);
const treesByAge = Object.groupBy(
  conifers,
  (node) => node.extras.tka_age_class
);
const tiers = Object.groupBy(
  semanticNodes.filter((node) => node.extras.tka_detail_tier),
  (node) => node.extras.tka_detail_tier
);
const rocks = semanticNodes.filter((node) => node.extras.tka_role === "rock");
const deadwood = semanticNodes.filter(
  (node) => node.extras.tka_role === "deadwood"
);
const stumps = semanticNodes.filter((node) => node.extras.tka_role === "stump");
const terrainNodes = semanticNodes.filter(
  (node) => node.extras.tka_role === "terrain"
);
const lightCount = gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0;
const instanceNodes = (gltf.nodes ?? []).filter(
  (node) => node.extensions?.EXT_mesh_gpu_instancing
);
const instanceCounts = instanceNodes
  .map((node) => {
    const accessor =
      node.extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION;
    return gltf.accessors?.[accessor]?.count ?? 0;
  })
  .sort((left, right) => left - right);

invariant(bytes <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${bytes}`);
invariant(gltf.scenes?.length === 1, "GLB must contain exactly one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the GLB");
invariant(lightCount === 0, "QA lights leaked into the GLB");
invariant(
  leakedNodes.length === 0,
  `QA nodes leaked: ${leakedNodes.join(", ")}`
);
invariant(
  forbiddenAuthoredNodes.length === 0,
  `Retired authored geometry survived: ${forbiddenAuthoredNodes.join(", ")}`
);
invariant(
  extensions.has("EXT_meshopt_compression"),
  "GLB lost meshopt compression"
);
invariant(extensions.has("EXT_mesh_gpu_instancing"), "GLB lost GPU instancing");
invariant(
  extensions.has("EXT_texture_webp"),
  "GLB textures are not WebP encoded"
);
invariant((tiers.base?.length ?? 0) > 0, "Base detail tier is missing");
invariant((tiers.medium?.length ?? 0) > 0, "Medium detail tier is missing");
invariant((tiers.high?.length ?? 0) > 0, "High detail tier is missing");
invariant(
  conifers.length === 34,
  `Expected 34 conifers, found ${conifers.length}`
);
invariant(
  treesByAge.mature?.length === 8,
  `Expected 8 mature conifers, found ${treesByAge.mature?.length ?? 0}`
);
invariant(
  treesByAge.mid?.length === 12,
  `Expected 12 mid-age conifers, found ${treesByAge.mid?.length ?? 0}`
);
invariant(
  treesByAge.young?.length === 14,
  `Expected 14 young conifers, found ${treesByAge.young?.length ?? 0}`
);
invariant(
  conifers.every((node) => node.extras.tka_crown_ratio >= 0.3),
  "A sparse conifer crown escaped the authored contract"
);
invariant(
  (treesByAge.young ?? []).every((node) => node.extras.tka_target_height <= 8),
  "A young conifer exceeds the 8m height ceiling"
);
invariant(
  rocks.length === 8,
  `Expected 8 scanned rocks, found ${rocks.length}`
);
invariant(
  new Set(rocks.map((node) => node.extras.tka_source_family)).size === 3,
  "Rock source-family variety is missing"
);
invariant(
  deadwood.length === 3,
  `Expected 3 detailed deadwood pieces, found ${deadwood.length}`
);
invariant(
  stumps.length === 1,
  `Expected 1 scanned stump, found ${stumps.length}`
);
invariant(
  terrainNodes.length === 1,
  `Expected one authored terrain, found ${terrainNodes.length}`
);
const terrain = terrainNodes[0].extras;
invariant(
  terrain.tka_boundary_shape === "irregular-radial",
  `Terrain boundary is not irregular-radial: ${terrain.tka_boundary_shape}`
);
invariant(
  terrain.tka_boundary_min_radius >= 148,
  `Terrain envelope is too small: ${terrain.tka_boundary_min_radius}`
);
invariant(
  terrain.tka_boundary_max_radius - terrain.tka_boundary_min_radius >= 20,
  "Terrain boundary lost its irregular silhouette"
);
invariant(
  terrain.tka_skirt_depth >= 14,
  `Terrain skirt is too shallow: ${terrain.tka_skirt_depth}`
);
invariant(
  terrain.tka_snow_surface_source === "ambientcg-snow004",
  `Unexpected snow surface source: ${terrain.tka_snow_surface_source}`
);
invariant(
  terrain.tka_snow_uv_metres >= 12,
  `Snow UV scale is too small: ${terrain.tka_snow_uv_metres}`
);
invariant(
  [...rocks, ...deadwood, ...stumps].every(
    (node) => node.extras.tka_burial_fraction >= 0.2
  ),
  "A hero prop is not sufficiently integrated into the snow"
);
invariant(
  instanceCounts.reduce((total, count) => total + count, 0) >= 40 &&
    instanceCounts.some((count) => count >= 6),
  "Authored scenery did not survive as meaningful GPU instance batches"
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
      instanceCounts,
      detailTiers: {
        base: tiers.base?.length ?? 0,
        medium: tiers.medium?.length ?? 0,
        high: tiers.high?.length ?? 0,
      },
      treesByAge: {
        mature: treesByAge.mature?.length ?? 0,
        mid: treesByAge.mid?.length ?? 0,
        young: treesByAge.young?.length ?? 0,
      },
      authoredProps: {
        rocks: rocks.length,
        deadwood: deadwood.length,
        stumps: stumps.length,
      },
      terrainEnvelope: {
        shape: terrain.tka_boundary_shape,
        minimumRadius: terrain.tka_boundary_min_radius,
        maximumRadius: terrain.tka_boundary_max_radius,
        skirtDepth: terrain.tka_skirt_depth,
      },
      snowSurface: {
        source: terrain.tka_snow_surface_source,
        uvMetres: terrain.tka_snow_uv_metres,
      },
    },
    null,
    2
  )
);
