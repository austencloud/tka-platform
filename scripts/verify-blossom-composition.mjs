#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const assetPath = resolve(
  projectRoot,
  "static/models/blossom/blossom_environment.glb"
);
const masterplanPath = resolve(
  projectRoot,
  "docs/superpowers/specs/blossom-masterplan-r2/blossom-masterplan-r2.json"
);
const evidencePath = resolve(
  projectRoot,
  "docs/superpowers/specs/blossom-masterplan-r2/evidence/blossom-production-phase2-validation.json"
);
const groundMaskPath = resolve(
  projectRoot,
  "static/textures/blossom-floor/blossom-ground-family-mask.png"
);

const [assetBuffer, masterplan, assetStats, groundMask] = await Promise.all([
  readFile(assetPath),
  readFile(masterplanPath, "utf8").then(JSON.parse),
  stat(assetPath),
  readFile(groundMaskPath),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readGlbJson(buffer) {
  invariant(buffer.toString("utf8", 0, 4) === "glTF", "Asset is not a GLB");
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.toString("utf8", 16, 20);
  invariant(jsonChunkType === "JSON", "GLB is missing its JSON chunk");
  return JSON.parse(buffer.subarray(20, 20 + jsonChunkLength).toString("utf8"));
}

function getInstanceCount(document, meshName) {
  const meshIndex = document.meshes.findIndex((mesh) => mesh.name === meshName);
  invariant(meshIndex >= 0, `Missing mesh: ${meshName}`);
  const nodes = document.nodes.filter((node) => node.mesh === meshIndex);
  return nodes.reduce((total, node) => {
    const accessorIndex =
      node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
    return (
      total +
      (accessorIndex === undefined
        ? 1
        : document.accessors[accessorIndex].count)
    );
  }, 0);
}

const document = readGlbJson(assetBuffer);
const namedNodes = new Map(
  document.nodes.filter((node) => node.name).map((node) => [node.name, node])
);
const namedMeshes = new Map(
  document.meshes.filter((mesh) => mesh.name).map((mesh) => [mesh.name, mesh])
);

invariant(
  masterplan.status === "approved-for-production" &&
    masterplan.approvalGate.productionChangesAllowed,
  "R2.1 was rejected on visual review (2026-08-23) — this validator must not report a verified composition for it"
);

for (const requiredNode of [
  "Garden_Ground",
  "River_Water",
  "Bridge_Planks",
  "Bridge_Rails",
  "Bridge_South_Landing",
  "Bridge_North_Landing",
  "Torii_Gate",
  "Operations_Backstage_Staging",
  "Operations_Prop_Storage",
  "Operations_Technical_Position",
]) {
  invariant(
    namedNodes.has(requiredNode),
    `Missing authored node: ${requiredNode}`
  );
}

invariant(
  ![...namedNodes.keys()].some((name) => name.startsWith("Audience_")),
  "Audience grading must remain part of the continuous terrain, not detached overlays"
);

for (const path of masterplan.circulation.paths) {
  if (path.id === "bridge-crossing") continue;
  const node = namedNodes.get(`Path_${path.id}`);
  invariant(node, `Missing circulation path: ${path.id}`);
  invariant(
    Math.abs(node.extras?.tka_path_width - path.width) <= 0.001,
    `Circulation width drifted: ${path.id}`
  );
}

const groundNode = namedNodes.get("Garden_Ground");
const terrain = masterplan.site.terrainBounds;
for (const [key, expected] of [
  ["tka_terrain_min_x", terrain.minX],
  ["tka_terrain_max_x", terrain.maxX],
  ["tka_terrain_min_y", terrain.minY],
  ["tka_terrain_max_y", terrain.maxY],
]) {
  invariant(
    Math.abs(groundNode.extras?.[key] - expected) <= 0.001,
    `Terrain envelope drifted at ${key}`
  );
}
invariant(
  namedMeshes.has("Blossom Continuous Garden Ground Mesh"),
  "The R2.1 continuous terrain mesh is missing"
);

const bridgeNode = namedNodes.get("Bridge_Planks");
invariant(
  bridgeNode.extras?.tka_bridge_slope_percent <= 5,
  `Bridge exceeds accessible slope: ${bridgeNode.extras?.tka_bridge_slope_percent}`
);

const decorativeNodes = document.nodes.filter((node) =>
  /PlantFactory_|Blossom_Grass_|Fallen_Petal|GardenEcology_/i.test(
    node.name ?? ""
  )
);
invariant(
  decorativeNodes.length === 0,
  `Phase 2 contains gated decoration: ${decorativeNodes.map((node) => node.name).join(", ")}`
);

const lanternCount = getInstanceCount(document, "Blossom KasugaLantern Mesh 1");
invariant(
  lanternCount === masterplan.lanterns.length,
  `Lantern count drifted: expected ${masterplan.lanterns.length}, got ${lanternCount}`
);

invariant(
  groundMask.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  "Blossom ground-family mask is not a valid PNG"
);

for (const extension of [
  "EXT_mesh_gpu_instancing",
  "EXT_meshopt_compression",
  "EXT_texture_webp",
]) {
  invariant(
    document.extensionsUsed?.includes(extension),
    `Missing runtime optimization: ${extension}`
  );
}

const assetSizeMiB = assetStats.size / 1024 / 1024;
invariant(assetSizeMiB < 32, "Optimized Blossom asset exceeds 32 MiB");

const validation = {
  planId: masterplan.planId,
  phase: "site-systems",
  status: "verified",
  checkedAt: new Date().toISOString(),
  asset: "static/models/blossom/blossom_environment.glb",
  assetSizeMiB: Number(assetSizeMiB.toFixed(2)),
  terrainEnvelope: terrain,
  audience: {
    zones: masterplan.audience.zones.length,
    capacity: masterplan.audience.capacity,
  },
  circulation: {
    totalPaths: masterplan.circulation.paths.length,
    publicPaths: masterplan.circulation.paths.filter(
      (path) => path.kind === "primary-accessible"
    ).length,
    servicePaths: masterplan.circulation.paths.filter(
      (path) => path.kind === "restricted-service"
    ).length,
  },
  water: {
    surfaceWidth: masterplan.water.surfaceWidth,
    localWidenings: masterplan.water.localWidenings.length,
    surfaceElevation: masterplan.water.surfaceElevation,
    bedDepth: masterplan.water.bedDepth,
  },
  bridgeSlopePercent: bridgeNode.extras.tka_bridge_slope_percent,
  lanterns: lanternCount,
  gatedDecorationNodes: decorativeNodes.length,
  extensions: document.extensionsUsed,
};

await mkdir(resolve(evidencePath, ".."), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(validation, null, 2)}\n`);
console.log(JSON.stringify(validation, null, 2));
