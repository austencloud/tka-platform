#!/usr/bin/env node
/** Verify the production Moonlit Winter Hollow GLB contract. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const glbPath = resolve("static/models/winter/winter-environment.glb");
const rawGlbPath = resolve("static/models/winter/winter-environment_raw.glb");
const treeLayoutPath = resolve("scripts/winter-tree-layout.json");
const settlementLayoutPath = resolve("scripts/winter-settlement-layout.json");
const compositionPlanPath = resolve("scripts/winter-composition-gate1-r2.json");
const lodgeProductionPath = resolve("scripts/winter-lodge-production.json");
const hearthProductionPath = resolve("scripts/winter-hearth-production.json");
const maximumBytes = 20 * 1024 * 1024;
// The production lodge and five high-detail chairs add bounded hero geometry
// to the established forest budget. Scanned ring stones reuse already-uploaded
// source meshes, so their repeated render cost belongs in the hearth allowance.
const maximumRenderedVertices = 2_100_000 + 30_000 + 300_000;
const settlementLayoutBytes = readFileSync(settlementLayoutPath);
const settlementLayout = JSON.parse(settlementLayoutBytes.toString("utf8"));
const settlementLayoutSha256 = createHash("sha256")
  .update(settlementLayoutBytes)
  .digest("hex");
const compositionPlanBytes = readFileSync(compositionPlanPath);
const compositionPlan = JSON.parse(compositionPlanBytes.toString("utf8"));
const compositionPlanSha256 = createHash("sha256")
  .update(compositionPlanBytes)
  .digest("hex");
invariant(
  compositionPlan.status === "approved" &&
    compositionPlan.approval?.visualComprehensionConfirmed === true,
  "Winter Gate 1 composition is not approved"
);
for (const landmarkId of ["stage", "lodge", "hearth", "pond"]) {
  invariant(
    JSON.stringify(settlementLayout[landmarkId].center) ===
      JSON.stringify(compositionPlan.proposedArrangement[landmarkId].center),
    `${landmarkId} drifted from the approved Gate 1 composition`
  );
}
const lodgeProductionBytes = readFileSync(lodgeProductionPath);
const lodgeProduction = JSON.parse(lodgeProductionBytes.toString("utf8"));
const lodgeProductionSha256 = createHash("sha256")
  .update(lodgeProductionBytes)
  .digest("hex");
const hearthProductionBytes = readFileSync(hearthProductionPath);
const hearthProduction = JSON.parse(hearthProductionBytes.toString("utf8"));
const hearthProductionSha256 = createHash("sha256")
  .update(hearthProductionBytes)
  .digest("hex");
const treeLayoutBytes = readFileSync(treeLayoutPath);
const treeLayout = JSON.parse(treeLayoutBytes.toString("utf8"));
const treeLayoutSha256 = createHash("sha256")
  .update(treeLayoutBytes)
  .digest("hex");
const treeAssets = new Map(treeLayout.assets.map((asset) => [asset.id, asset]));
const forbiddenTreeSources = new Set(
  treeLayout.requirements.forbiddenSourceFiles ?? []
);
const settlementCorridors = settlementLayout.paths.map((path) => ({
  id: path.id,
  role: path.role,
  halfWidth: path.treeHalfWidth,
  shoulderWidth: path.treeShoulderWidth,
  points: path.points.map(([x, z]) => [x, -z]),
}));
const treeCorridors = [...treeLayout.corridors, ...settlementCorridors];

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
  const binaryChunkHeader = 20 + jsonLength;
  invariant(
    buffer.readUInt32LE(binaryChunkHeader + 4) === 0x004e4942,
    "GLB binary chunk is missing"
  );
  return {
    bytes: buffer.length,
    buffer,
    binaryOffset: binaryChunkHeader + 8,
    json: JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8")),
  };
}

function ktx2Dimensions(gltfDocument, glbBuffer, binaryOffset, imageIndex) {
  const image = gltfDocument.images?.[imageIndex];
  invariant(
    image?.bufferView !== undefined,
    `Texture image ${imageIndex} is not embedded`
  );
  const bufferView = gltfDocument.bufferViews?.[image.bufferView];
  invariant(bufferView, `Texture image ${imageIndex} has no buffer view`);
  const start = binaryOffset + (bufferView.byteOffset ?? 0);
  const identifier = glbBuffer.subarray(start, start + 12).toString("hex");
  invariant(
    identifier === "ab4b5458203230bb0d0a1a0a",
    `Texture image ${imageIndex} is not KTX2`
  );
  return {
    width: glbBuffer.readUInt32LE(start + 20),
    height: glbBuffer.readUInt32LE(start + 24),
  };
}

function textureImageIndex(gltfDocument, textureIndex) {
  const texture = gltfDocument.textures?.[textureIndex];
  invariant(texture, `Material references missing texture ${textureIndex}`);
  return texture.extensions?.KHR_texture_basisu?.source ?? texture.source;
}

function pointSegmentDistance(x, y, start, end) {
  const segmentX = end[0] - start[0];
  const segmentY = end[1] - start[1];
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared <= 0.000001) return Math.hypot(x - start[0], y - start[1]);
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((x - start[0]) * segmentX + (y - start[1]) * segmentY) / lengthSquared
    )
  );
  return Math.hypot(
    x - (start[0] + segmentX * projection),
    y - (start[1] + segmentY * projection)
  );
}

function distanceToCorridor(x, y, corridor) {
  return Math.min(
    ...corridor.points
      .slice(0, -1)
      .map((point, index) =>
        pointSegmentDistance(x, y, point, corridor.points[index + 1])
      )
  );
}

function runtimePointToBlender([x, z]) {
  return [x, -z];
}

function localFrontYaw(center, target) {
  return Math.atan2(target[0] - center[0], -(target[1] - center[1]));
}

function settlementLocalCoordinates(x, y, center, yaw) {
  const dx = x - center[0];
  const dy = y - center[1];
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [dx * cosine + dy * sine, -dx * sine + dy * cosine];
}

function treeEntersSettlementExclusion(node, asset) {
  const margin = settlementLayout.requirements.minimumTreeExclusionMarginMetres;
  return settlementLayout.treeExclusions.some((exclusion) => {
    const center = runtimePointToBlender(exclusion.center);
    const padding = asset.footprintRadius + margin;
    if (exclusion.shape === "circle") {
      return (
        Math.hypot(
          node.extras.tka_plan_x - center[0],
          node.extras.tka_plan_y - center[1]
        ) <
        exclusion.radius + padding
      );
    }
    invariant(
      exclusion.shape === "lodge-rectangle",
      `Unsupported settlement exclusion: ${exclusion.shape}`
    );
    const target = runtimePointToBlender(exclusion.frontFaces);
    const yaw = localFrontYaw(center, target);
    const [localX, localY] = settlementLocalCoordinates(
      node.extras.tka_plan_x,
      node.extras.tka_plan_y,
      center,
      yaw
    );
    return (
      Math.abs(localX) < exclusion.halfSize[0] + padding &&
      Math.abs(localY) < exclusion.halfSize[1] + padding
    );
  });
}

const expectedClusterCounts = Object.fromEntries(
  treeLayout.clusters.map((cluster) => [
    cluster.id,
    Object.values(cluster.counts).reduce((total, count) => total + count, 0),
  ])
);
const expectedBandCounts = Object.fromEntries(
  Object.keys(treeLayout.bands).map((band) => [
    band,
    treeLayout.clusters
      .filter((cluster) => cluster.band === band)
      .reduce(
        (total, cluster) =>
          total +
          Object.values(cluster.counts).reduce(
            (clusterTotal, count) => clusterTotal + count,
            0
          ),
        0
      ),
  ])
);
const expectedAgeCounts = { mature: 0, mid: 0, young: 0 };
const expectedTreeTierCounts = { base: 0, medium: 0, high: 0 };
for (const cluster of treeLayout.clusters) {
  const tier = treeLayout.bands[cluster.band].detailTier;
  for (const [assetId, count] of Object.entries(cluster.counts)) {
    expectedAgeCounts[treeAssets.get(assetId).ageClass] += count;
    expectedTreeTierCounts[tier] += count;
  }
}

const {
  bytes,
  buffer: glbBuffer,
  binaryOffset,
  json: gltf,
} = readGlbJson(glbPath);
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
const treesByBand = Object.groupBy(
  conifers,
  (node) => node.extras.tka_depth_band
);
const treesByCluster = Object.groupBy(
  conifers,
  (node) => node.extras.tka_cluster_id
);
const treeTiers = Object.groupBy(
  conifers,
  (node) => node.extras.tka_detail_tier
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
const settlementNodes = semanticNodes.filter((node) =>
  node.extras.tka_role?.startsWith("settlement-")
);
const settlementByRole = Object.groupBy(
  settlementNodes,
  (node) => node.extras.tka_role
);
const heroDeliveryRoles = new Set(["settlement-lodge", "settlement-seat"]);
const heroMeshIndices = new Set(
  (gltf.nodes ?? [])
    .filter(
      (node) =>
        node.mesh !== undefined && heroDeliveryRoles.has(node.extras?.tka_role)
    )
    .map((node) => node.mesh)
);
const heroMaterialIndices = new Set(
  [...heroMeshIndices].flatMap((meshIndex) =>
    (gltf.meshes?.[meshIndex]?.primitives ?? [])
      .map((primitive) => primitive.material)
      .filter((materialIndex) => materialIndex !== undefined)
  )
);
const woodpileLogs = semanticNodes.filter(
  (node) => node.extras.tka_role === "lodge-woodpile-log"
);
const detailTextureIndices = new Set();
const colorTextureIndices = new Set();
const heroDetailTextureIndices = new Set();
const heroColorTextureIndices = new Set();
for (const [materialIndex, material] of (gltf.materials ?? []).entries()) {
  for (const textureInfo of [
    material.normalTexture,
    material.occlusionTexture,
    material.pbrMetallicRoughness?.metallicRoughnessTexture,
  ]) {
    if (textureInfo?.index !== undefined) {
      detailTextureIndices.add(textureInfo.index);
      if (heroMaterialIndices.has(materialIndex))
        heroDetailTextureIndices.add(textureInfo.index);
    }
  }
  for (const textureInfo of [
    material.emissiveTexture,
    material.pbrMetallicRoughness?.baseColorTexture,
  ]) {
    if (textureInfo?.index !== undefined) {
      colorTextureIndices.add(textureInfo.index);
      if (heroMaterialIndices.has(materialIndex))
        heroColorTextureIndices.add(textureInfo.index);
    }
  }
}
const textureDimensions = (gltf.textures ?? []).map((_, textureIndex) => {
  const imageIndex = textureImageIndex(gltf, textureIndex);
  invariant(
    imageIndex !== undefined,
    `Texture ${textureIndex} has no image source`
  );
  return {
    textureIndex,
    imageIndex,
    ...ktx2Dimensions(gltf, glbBuffer, binaryOffset, imageIndex),
  };
});
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
const renderedVertexCount = (gltf.nodes ?? []).reduce((total, node) => {
  if (node.mesh === undefined) return total;
  const mesh = gltf.meshes?.[node.mesh];
  const instanceAccessor =
    node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
  const instanceCount =
    instanceAccessor === undefined
      ? 1
      : (gltf.accessors?.[instanceAccessor]?.count ?? 0);
  const drawCount = (mesh?.primitives ?? []).reduce((meshTotal, primitive) => {
    if (primitive.indices === undefined) return meshTotal;
    return meshTotal + (gltf.accessors?.[primitive.indices]?.count ?? 0);
  }, 0);
  return total + drawCount * instanceCount;
}, 0);
const uploadedPositionVertexCount = (gltf.meshes ?? []).reduce(
  (total, mesh) =>
    total +
    mesh.primitives.reduce(
      (meshTotal, primitive) =>
        meshTotal +
        (gltf.accessors?.[primitive.attributes?.POSITION]?.count ?? 0),
      0
    ),
  0
);

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
  extensions.has("KHR_texture_basisu"),
  "GLB textures are not GPU-compressed KTX2"
);
invariant(
  !extensions.has("EXT_texture_webp"),
  "Legacy WebP textures survived the KTX2 delivery pass"
);
const textureCount = gltf.textures?.length ?? 0;
const tinyPaletteTextures = textureDimensions.filter(
  ({ width, height }) => width <= 64 && height <= 4
);
const authoredTextureBudget =
  42 +
  lodgeProduction.asset.textureBudgetContribution +
  hearthProduction.chair.textureBudgetContribution +
  hearthProduction.fireBed.textureBudgetContribution;
invariant(
  textureCount <= authoredTextureBudget ||
    (textureCount <= authoredTextureBudget + 2 &&
      tinyPaletteTextures.length >= textureCount - authoredTextureBudget),
  `Winter texture count exceeds its budget without tiny palette packing: ${textureCount}`
);
invariant(
  renderedVertexCount <= maximumRenderedVertices,
  `Winter render vertex budget exceeded: ${renderedVertexCount}`
);
invariant(
  uploadedPositionVertexCount <= 150_000,
  `Winter upload vertex budget exceeded: ${uploadedPositionVertexCount}`
);
invariant(
  textureDimensions.every(({ textureIndex, width, height }) => {
    const heroTexture =
      heroColorTextureIndices.has(textureIndex) ||
      heroDetailTextureIndices.has(textureIndex);
    const ceiling = heroTexture ? 2048 : 1024;
    return width <= ceiling && height <= ceiling;
  }),
  "A Winter texture exceeds its role-specific delivery ceiling"
);
invariant(
  [...heroDetailTextureIndices].every((textureIndex) => {
    const dimensions = textureDimensions[textureIndex];
    return dimensions.width <= 1024 && dimensions.height <= 1024;
  }),
  "A lodge/chair detail texture exceeds the 1024px hero ceiling"
);
invariant(
  [...detailTextureIndices]
    .filter((textureIndex) => !heroDetailTextureIndices.has(textureIndex))
    .every((textureIndex) => {
      const dimensions = textureDimensions[textureIndex];
      return dimensions.width <= 512 && dimensions.height <= 512;
    }),
  "A background Winter detail texture exceeds the 512px delivery ceiling"
);
invariant(
  [...heroColorTextureIndices].every((textureIndex) => {
    const dimensions = textureDimensions[textureIndex];
    return dimensions.width <= 2048 && dimensions.height <= 2048;
  }),
  "A lodge/chair color texture exceeds the 2048px hero ceiling"
);
invariant(
  [...colorTextureIndices]
    .filter((textureIndex) => !heroColorTextureIndices.has(textureIndex))
    .every((textureIndex) => {
      const dimensions = textureDimensions[textureIndex];
      return dimensions.width <= 1024 && dimensions.height <= 1024;
    }),
  "A background Winter color texture exceeds the 1024px delivery ceiling"
);
invariant(
  heroMeshIndices.size > 0 &&
    heroColorTextureIndices.size > 0 &&
    heroDetailTextureIndices.size > 0,
  "The lodge/chair hero-delivery texture set is empty"
);
invariant((tiers.base?.length ?? 0) > 0, "Base detail tier is missing");
invariant((tiers.medium?.length ?? 0) > 0, "Medium detail tier is missing");
invariant((tiers.high?.length ?? 0) > 0, "High detail tier is missing");
invariant(
  conifers.length === treeLayout.requirements.treeCount,
  `Expected ${treeLayout.requirements.treeCount} conifers, found ${conifers.length}`
);
for (const [age, expectedCount] of Object.entries(expectedAgeCounts)) {
  invariant(
    (treesByAge[age]?.length ?? 0) === expectedCount,
    `Expected ${expectedCount} ${age} conifers, found ${treesByAge[age]?.length ?? 0}`
  );
}
for (const [band, expectedCount] of Object.entries(expectedBandCounts)) {
  invariant(
    (treesByBand[band]?.length ?? 0) === expectedCount,
    `Expected ${expectedCount} ${band}-band conifers, found ${treesByBand[band]?.length ?? 0}`
  );
  invariant(
    expectedCount >= treeLayout.requirements.minimumBandCounts[band],
    `The ${band} tree band misses its minimum density`
  );
}
for (const [tier, expectedCount] of Object.entries(expectedTreeTierCounts)) {
  invariant(
    (treeTiers[tier]?.length ?? 0) === expectedCount,
    `Expected ${expectedCount} ${tier}-tier conifers, found ${treeTiers[tier]?.length ?? 0}`
  );
}
invariant(
  Object.keys(treesByCluster).length === treeLayout.requirements.clusterCount,
  `Expected ${treeLayout.requirements.clusterCount} tree clusters, found ${Object.keys(treesByCluster).length}`
);
for (const [clusterId, expectedCount] of Object.entries(
  expectedClusterCounts
)) {
  invariant(
    (treesByCluster[clusterId]?.length ?? 0) === expectedCount,
    `Expected ${expectedCount} trees in ${clusterId}, found ${treesByCluster[clusterId]?.length ?? 0}`
  );
}
invariant(
  conifers.every(
    (node) =>
      node.extras.tka_tree_layout_version === treeLayout.version &&
      node.extras.tka_tree_layout_sha256 === treeLayoutSha256 &&
      Number.isFinite(node.extras.tka_plan_x) &&
      Number.isFinite(node.extras.tka_plan_y) &&
      treeAssets.has(node.extras.tka_tree_asset)
  ),
  "A conifer escaped the versioned tree-layout contract"
);
for (const node of conifers) {
  const asset = treeAssets.get(node.extras.tka_tree_asset);
  invariant(
    node.extras.tka_source_file === asset.sourceFile,
    `${node.name} uses ${node.extras.tka_source_file}, expected ${asset.sourceFile}`
  );
  invariant(
    node.extras.tka_source_key === asset.sourceKey,
    `${node.name} uses ${node.extras.tka_source_key}, expected ${asset.sourceKey}`
  );
  invariant(
    node.extras.tka_source_decimation_ratio >=
      asset.minimumSourceDecimationRatio,
    `${node.name} was over-decimated to ${node.extras.tka_source_decimation_ratio}`
  );
  invariant(
    !forbiddenTreeSources.has(node.extras.tka_source_file),
    `${node.name} retained forbidden source ${node.extras.tka_source_file}`
  );
}
const corridorClearances = conifers.flatMap((node) => {
  const asset = treeAssets.get(node.extras.tka_tree_asset);
  return treeCorridors.map(
    (corridor) =>
      distanceToCorridor(
        node.extras.tka_plan_x,
        node.extras.tka_plan_y,
        corridor
      ) -
      corridor.halfWidth -
      corridor.shoulderWidth -
      asset.corridorClearance
  );
});
const minimumCorridorClearance = Math.min(...corridorClearances);
invariant(
  minimumCorridorClearance >=
    treeLayout.requirements.minimumCorridorClearanceMetres,
  `A tree entered a protected sightline: ${minimumCorridorClearance}m clearance`
);
invariant(
  conifers.every((node) => {
    const asset = treeAssets.get(node.extras.tka_tree_asset);
    return !treeEntersSettlementExclusion(node, asset);
  }),
  "A conifer entered the lodge yard or hearth social pocket"
);
const radialPositions = conifers
  .map((node) => Math.hypot(node.extras.tka_plan_x, node.extras.tka_plan_y))
  .sort((left, right) => left - right);
const maximumRadialGap = Math.max(
  ...radialPositions
    .slice(1)
    .map((radius, index) => radius - radialPositions[index])
);
invariant(
  maximumRadialGap <= treeLayout.requirements.maximumRadialGapMetres,
  `Tree layers leave an abrupt radial gap: ${maximumRadialGap}m`
);
invariant(
  conifers.filter((node) => node.extras.tka_crown_ratio >= 0.3).length >=
    Math.ceil(conifers.length * 0.95),
  "Fewer than 95% of the conifers meet the lush-crown contract"
);
invariant(
  conifers.every(
    (node) =>
      Number.isFinite(node.extras.tka_grounding_error) &&
      node.extras.tka_grounding_error <= 0.015 &&
      node.extras.tka_root_bed_depth >= 0.3 &&
      node.extras.tka_root_bed_depth <= 0.48
  ),
  "A conifer escaped the terrain-contact contract"
);
invariant(
  (treesByBand.far ?? []).every(
    (node) =>
      node.extras.tka_horizon_root_contact === true &&
      node.extras.tka_root_bed_depth >=
        treeLayout.requirements.minimumFarTreeBedDepthMetres
  ),
  "A far-band conifer is not deeply bedded into the snow"
);
invariant(
  (treesByAge.young ?? []).every((node) => node.extras.tka_target_height <= 8),
  "A young conifer exceeds the 8m height ceiling"
);
invariant(
  rocks.length === 12,
  `Expected 12 scanned rocks, found ${rocks.length}`
);
invariant(
  new Set(rocks.map((node) => node.extras.tka_source_family)).size === 3,
  "Rock source-family variety is missing"
);
invariant(
  deadwood.length === 5,
  `Expected 5 detailed deadwood pieces, found ${deadwood.length}`
);
invariant(
  stumps.length === 1,
  `Expected 1 scanned stump, found ${stumps.length}`
);
const expectedSettlementRoleCounts = {
  "settlement-lodge": 1,
  "settlement-hearth": 1,
  "settlement-seat": settlementLayout.hearth.seatCount,
  "settlement-hearth-contact-zone": 1,
  "settlement-hearth-mineral-bed": 1,
  "settlement-hearth-ash-bed": 1,
  "settlement-hearth-stone": hearthProduction.fireBed.stoneCount,
  "settlement-hearth-fuel": hearthProduction.fireBed.fuelLogCount,
  "settlement-hearth-ember": hearthProduction.fireBed.emberCount,
  "settlement-path": settlementLayout.paths.length,
  "settlement-ramp": 1,
};
for (const [role, expectedCount] of Object.entries(
  expectedSettlementRoleCounts
)) {
  invariant(
    (settlementByRole[role]?.length ?? 0) === expectedCount,
    `Expected ${expectedCount} ${role} nodes, found ${settlementByRole[role]?.length ?? 0}`
  );
}
invariant(
  settlementNodes.every(
    (node) =>
      node.extras.tka_settlement_layout_version === settlementLayout.version &&
      node.extras.tka_settlement_layout_sha256 === settlementLayoutSha256 &&
      node.extras.tka_composition_plan_version === compositionPlan.version &&
      node.extras.tka_composition_plan_sha256 === compositionPlanSha256
  ),
  "A settlement object escaped the approved composition contract"
);
const productionLodge = settlementByRole["settlement-lodge"][0];
invariant(
  productionLodge.extras.tka_lodge_production_version ===
    lodgeProduction.version &&
    productionLodge.extras.tka_lodge_production_sha256 ===
      lodgeProductionSha256 &&
    productionLodge.extras.tka_source_asset === lodgeProduction.asset.id,
  "The lodge escaped its versioned production contract"
);
invariant(
  woodpileLogs.length >= lodgeProduction.requirements.minimumWoodpileLogs,
  `Expected at least ${lodgeProduction.requirements.minimumWoodpileLogs} lodge firewood logs, found ${woodpileLogs.length}`
);
const hearthSeats = settlementByRole["settlement-seat"];
invariant(
  hearthSeats.length === hearthProduction.requirements.chairCount,
  `Expected ${hearthProduction.requirements.chairCount} production hearth chairs, found ${hearthSeats.length}`
);
invariant(
  hearthSeats.every(
    (seat) =>
      seat.extras.tka_hearth_production_version === hearthProduction.version &&
      seat.extras.tka_hearth_production_sha256 === hearthProductionSha256 &&
      seat.extras.tka_source_asset === hearthProduction.chair.id &&
      seat.extras.tka_burial_depth >=
        hearthProduction.clearances.minimumChairBurialMetres
  ),
  "A hearth chair escaped its production or grounding contract"
);
const sortedSeatAngles = [...settlementLayout.hearth.seatAnglesDegrees].sort(
  (a, b) => a - b
);
const seatGaps = sortedSeatAngles
  .slice(0, -1)
  .map((angle, index) => sortedSeatAngles[index + 1] - angle);
seatGaps.push(sortedSeatAngles[0] + 360 - sortedSeatAngles.at(-1));
const maximumSeatGap = Math.max(...seatGaps);
invariant(
  maximumSeatGap >= hearthProduction.clearances.minimumRouteOpeningDegrees,
  `Hearth route opening is too narrow: ${maximumSeatGap} degrees`
);
const maximumChairDepth =
  hearthProduction.chair.targetDimensions[1] *
  Math.max(...hearthProduction.chair.scaleMultipliers);
const seatToStoneClearance =
  settlementLayout.hearth.seatRadius -
  maximumChairDepth / 2 -
  hearthProduction.fireBed.stoneRingRadius -
  hearthProduction.fireBed.stoneDimensions[0] / 2;
invariant(
  seatToStoneClearance >= hearthProduction.clearances.minimumSeatToStoneMetres,
  `Hearth seat-to-stone clearance is too small: ${seatToStoneClearance}m`
);
const stageToHearth = Math.hypot(
  settlementLayout.hearth.center[0] - settlementLayout.stage.center[0],
  settlementLayout.hearth.center[1] - settlementLayout.stage.center[1]
);
const hearthToLodge = Math.hypot(
  settlementLayout.hearth.center[0] - settlementLayout.lodge.center[0],
  settlementLayout.hearth.center[1] - settlementLayout.lodge.center[1]
);
const stageToLodge = Math.hypot(
  settlementLayout.lodge.center[0] - settlementLayout.stage.center[0],
  settlementLayout.lodge.center[1] - settlementLayout.stage.center[1]
);
const stageToPond = Math.hypot(
  settlementLayout.pond.center[0] - settlementLayout.stage.center[0],
  settlementLayout.pond.center[1] - settlementLayout.stage.center[1]
);
invariant(
  stageToHearth >= settlementLayout.requirements.minimumStageToHearthMetres,
  `Hearth is too close to the stage: ${stageToHearth}m`
);
invariant(
  hearthToLodge >= settlementLayout.requirements.minimumHearthToLodgeMetres,
  `Lodge is too close to the hearth: ${hearthToLodge}m`
);
invariant(
  stageToLodge >= settlementLayout.requirements.minimumStageToLodgeMetres,
  `Lodge is too close to the stage: ${stageToLodge}m`
);
invariant(
  stageToPond >= settlementLayout.requirements.minimumPondToStageMetres,
  `Pond is too close to the stage: ${stageToPond}m`
);
invariant(
  settlementLayout.paths.every(
    (path) =>
      path.width >= settlementLayout.requirements.minimumRouteWidthMetres
  ),
  "A settlement route is too narrow"
);
const settlementRamp = settlementByRole["settlement-ramp"][0].extras;
invariant(
  settlementRamp.tka_ramp_grade <=
    settlementLayout.requirements.maximumRampGrade,
  `Stage ramp is too steep: ${settlementRamp.tka_ramp_grade}`
);
invariant(
  terrainNodes.length === 1,
  `Expected one authored terrain, found ${terrainNodes.length}`
);
const terrain = terrainNodes[0].extras;
invariant(
  terrain.tka_tree_layout_version === treeLayout.version &&
    terrain.tka_tree_layout_sha256 === treeLayoutSha256 &&
    terrain.tka_tree_count === treeLayout.requirements.treeCount &&
    terrain.tka_tree_cluster_count === treeLayout.requirements.clusterCount,
  "Terrain metadata does not match the tree-layout contract"
);
invariant(
  terrain.tka_settlement_layout_version === settlementLayout.version &&
    terrain.tka_settlement_layout_sha256 === settlementLayoutSha256 &&
    terrain.tka_composition_plan_version === compositionPlan.version &&
    terrain.tka_composition_plan_sha256 === compositionPlanSha256 &&
    Math.abs(terrain.tka_stage_to_hearth_distance - stageToHearth) < 0.001 &&
    Math.abs(terrain.tka_stage_to_lodge_distance - stageToLodge) < 0.001 &&
    Math.abs(terrain.tka_hearth_to_lodge_distance - hearthToLodge) < 0.001 &&
    Math.abs(terrain.tka_stage_to_pond_distance - stageToPond) < 0.001 &&
    terrain.tka_maximum_route_grade <=
      settlementLayout.requirements.maximumRouteGrade,
  "Terrain metadata does not match the approved composition contract"
);
invariant(
  terrain.tka_hearth_production_version === hearthProduction.version &&
    terrain.tka_hearth_production_sha256 === hearthProductionSha256,
  "Terrain metadata does not match the hearth-production contract"
);
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
  terrain.tka_underside_closed === true,
  "Terrain underside is open to low orbit views"
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
  terrain.tka_hero_path_profile === "curved-snow-trough-v1" &&
    terrain.tka_hero_path_half_width ===
      treeLayout.corridors.find((corridor) => corridor.id === "hero-approach")
        .halfWidth &&
    terrain.tka_hero_path_minimum_bank_relief >=
      treeLayout.requirements.minimumPathBankReliefMetres,
  "Hero approach terrain profile does not match the composition contract"
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
      textureDelivery: {
        format: "KTX2",
        maximumDimension: Math.max(
          ...textureDimensions.flatMap(({ width, height }) => [width, height])
        ),
        detailTextureCount: detailTextureIndices.size,
        colorTextureCount: colorTextureIndices.size,
      },
      geometryDelivery: {
        renderedVertexCount,
        uploadedPositionVertexCount,
      },
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
      treeComposition: {
        layoutVersion: treeLayout.version,
        layoutSha256: treeLayoutSha256,
        clusters: Object.keys(treesByCluster).length,
        bands: Object.fromEntries(
          Object.entries(treesByBand).map(([band, nodes]) => [
            band,
            nodes.length,
          ])
        ),
        minimumCorridorClearance,
        maximumRadialGap,
      },
      treeGrounding: {
        maximumError: Math.max(
          ...conifers.map((node) => node.extras.tka_grounding_error)
        ),
        minimumBedDepth: Math.min(
          ...conifers.map((node) => node.extras.tka_root_bed_depth)
        ),
        maximumBedDepth: Math.max(
          ...conifers.map((node) => node.extras.tka_root_bed_depth)
        ),
        minimumFarBedDepth: Math.min(
          ...(treesByBand.far ?? []).map(
            (node) => node.extras.tka_root_bed_depth
          )
        ),
      },
      treeSources: Object.fromEntries(
        Object.entries(
          Object.groupBy(conifers, (node) => node.extras.tka_source_file)
        ).map(([sourceFile, nodes]) => [sourceFile, nodes.length])
      ),
      authoredProps: {
        rocks: rocks.length,
        deadwood: deadwood.length,
        stumps: stumps.length,
      },
      settlementComposition: {
        compositionPlanVersion: compositionPlan.version,
        compositionPlanSha256,
        layoutVersion: settlementLayout.version,
        layoutSha256: settlementLayoutSha256,
        stageToHearth,
        stageToLodge,
        hearthToLodge,
        stageToPond,
        maximumRouteGrade: terrain.tka_maximum_route_grade,
        rampGrade: settlementRamp.tka_ramp_grade,
        roleCounts: expectedSettlementRoleCounts,
        lodgeProductionVersion: lodgeProduction.version,
        lodgeProductionSha256,
        woodpileLogs: woodpileLogs.length,
        hearthProductionVersion: hearthProduction.version,
        hearthProductionSha256,
        hearthSeatToStoneClearance: seatToStoneClearance,
        hearthRouteOpeningDegrees: maximumSeatGap,
      },
      terrainEnvelope: {
        shape: terrain.tka_boundary_shape,
        minimumRadius: terrain.tka_boundary_min_radius,
        maximumRadius: terrain.tka_boundary_max_radius,
        skirtDepth: terrain.tka_skirt_depth,
        heroPathMinimumBankRelief: terrain.tka_hero_path_minimum_bank_relief,
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
