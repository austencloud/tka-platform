#!/usr/bin/env node
/** Verify the production Moonlit Firefly Forest GLB contract. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const glbPath = resolve("static/models/forest/forest-environment.glb");
const rawGlbPath = resolve("static/models/forest/forest-environment_raw.glb");
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
const terrainNodes = rawNodes.filter(
  (node) => node.extras?.tka_role === "terrain"
);
const leakedNodes = nodeNames.filter((name) => /^(QA_)/.test(name));
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
  extensions.has("EXT_meshopt_compression"),
  "GLB lost meshopt compression"
);
invariant(
  extensions.has("EXT_texture_webp"),
  "GLB textures are not WebP encoded"
);
invariant(
  terrainNodes.length === 1,
  `Expected one authored terrain, found ${terrainNodes.length}`
);

const terrain = terrainNodes[0].extras;
invariant(
  terrain.tka_phase === "world-envelope",
  `Unexpected Forest terrain phase: ${terrain.tka_phase}`
);
invariant(
  terrain.tka_boundary_shape === "irregular-radial",
  `Terrain boundary is not irregular-radial: ${terrain.tka_boundary_shape}`
);
invariant(
  terrain.tka_clearing_radius >= 30,
  `Terrain clearing is too small: ${terrain.tka_clearing_radius}`
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
  terrain.tka_skirt_depth >= 18,
  `Terrain skirt is too shallow: ${terrain.tka_skirt_depth}`
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
      terrainEnvelope: {
        shape: terrain.tka_boundary_shape,
        clearingRadius: terrain.tka_clearing_radius,
        minimumRadius: terrain.tka_boundary_min_radius,
        maximumRadius: terrain.tka_boundary_max_radius,
        skirtDepth: terrain.tka_skirt_depth,
      },
    },
    null,
    2
  )
);
