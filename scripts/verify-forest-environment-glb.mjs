#!/usr/bin/env node
/** Verify the production Moonlit Firefly Forest GLB contract. */

import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const glbPath = resolve("static/models/forest/forest-environment.glb");
const pathLayoutPath = resolve("scripts/forest-path-layout.json");
const pathLayoutBytes = readFileSync(pathLayoutPath);
const pathLayout = JSON.parse(pathLayoutBytes.toString("utf8"));
const pathLayoutSha256 = createHash("sha256")
  .update(pathLayoutBytes)
  .digest("hex");
const treeLayoutPath = resolve("scripts/forest-tree-layout.json");
const treeLayoutBytes = readFileSync(treeLayoutPath);
const treeLayout = JSON.parse(treeLayoutBytes.toString("utf8"));
const treeLayoutSha256 = createHash("sha256")
  .update(treeLayoutBytes)
  .digest("hex");
const expectedTreeAssetIds = treeLayout.assets.map((asset) => asset.id);
const expectedTreeAssetCounts = Object.fromEntries(
  expectedTreeAssetIds.map((assetId) => [
    assetId,
    treeLayout.clusters.reduce(
      (count, cluster) => count + Number(cluster.counts[assetId] ?? 0),
      0
    ),
  ])
);
const expectedTreeCount = Object.values(expectedTreeAssetCounts).reduce(
  (total, count) => total + count,
  0
);
const groundLayoutPath = resolve("scripts/forest-ground-life-layout.json");
const groundLayoutBytes = readFileSync(groundLayoutPath);
const groundLayout = JSON.parse(groundLayoutBytes.toString("utf8"));
const groundLayoutSha256 = createHash("sha256")
  .update(groundLayoutBytes)
  .digest("hex");
const groundEcologyPath = resolve("scripts/forest-ground-life-ecology.json");
const groundEcologyBytes = readFileSync(groundEcologyPath);
const groundEcology = JSON.parse(groundEcologyBytes.toString("utf8"));
const groundEcologySha256 = createHash("sha256")
  .update(groundEcologyBytes)
  .digest("hex");
const expectedGroundHabitatIds = groundEcology.habitats.map(
  (habitat) => habitat.id
);
const expectedGroundVariantIds = groundEcology.families.flatMap((family) =>
  family.variants.map((variant) => `${family.id}-${variant}`)
);
const expectedGroundModuleTypes = groundEcology.groundModules;
const maximumBytes = 20 * 1024 * 1024;
const expectedMaterialZones = [
  "Packed Performance Clearing",
  "Path Soil",
  "Leaf Duff",
  "Shade Moss",
  "Damp Hollow",
  "Quiet Distant Ground",
];

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
const extensions = new Set(gltf.extensionsUsed ?? []);
const nodeNames = (gltf.nodes ?? []).map((node) => node.name ?? "");
const terrainNodes = (gltf.nodes ?? []).filter(
  (node) => node.extras?.tka_role === "terrain"
);
const instancingNodes = (gltf.nodes ?? []).filter(
  (node) => node.extensions?.EXT_mesh_gpu_instancing
);
const instancedMeshName = (node) => gltf.meshes?.[node.mesh]?.name ?? "";
const treeInstancingNodes = instancingNodes.filter((node) =>
  instancedMeshName(node).startsWith("ForestTreeMesh_")
);
const groundVariantInstancingNodes = instancingNodes.filter((node) =>
  instancedMeshName(node).startsWith("ForestGroundLifeVariantMesh_")
);
const groundMushroomInstancingNodes = instancingNodes.filter((node) =>
  instancedMeshName(node).startsWith("ForestGroundMushroomMesh_")
);
const groundModuleInstancingNodes = instancingNodes.filter((node) =>
  instancedMeshName(node).startsWith("ForestGroundModuleMesh_")
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
  extensions.has("EXT_mesh_gpu_instancing"),
  "GLB lost required GPU instancing"
);
invariant(
  terrainNodes.length === 1,
  `Expected one authored terrain, found ${terrainNodes.length}`
);

const terrain = terrainNodes[0].extras;
const materialZoneNames = String(terrain.tka_material_zone_names ?? "").split(
  "|"
);
const materialZoneCounts = Array.from(terrain.tka_material_zone_counts ?? []);
invariant(
  terrain.tka_phase === "world-envelope",
  `Unexpected Forest terrain phase: ${terrain.tka_phase}`
);
invariant(
  terrain.tka_material_phase === "forest-floor-zones",
  `Unexpected Forest material phase: ${terrain.tka_material_phase}`
);
invariant(
  materialZoneNames.length === expectedMaterialZones.length &&
    materialZoneNames.every(
      (name, index) => name === expectedMaterialZones[index]
    ),
  `Unexpected Forest material zones: ${materialZoneNames.join(", ")}`
);
invariant(
  materialZoneCounts.length === expectedMaterialZones.length &&
    materialZoneCounts.every((count) => Number(count) > 0),
  `Every Forest material zone must own polygons: ${materialZoneCounts.join(", ")}`
);
invariant(
  Math.abs(Number(terrain.tka_uv_metres_per_tile) - 5.2) < 0.001,
  `Unexpected Forest texture scale: ${terrain.tka_uv_metres_per_tile}`
);
invariant(
  terrain.tka_macro_diffuse === "forest-floor-zoned.jpg",
  `Unexpected Forest macro diffuse: ${terrain.tka_macro_diffuse}`
);
const pathNames = String(terrain.tka_path_names ?? "").split("|");
const pathRoles = String(terrain.tka_path_roles ?? "").split("|");
invariant(
  terrain.tka_path_phase === "path-and-clearing-composition",
  `Unexpected Forest path phase: ${terrain.tka_path_phase}`
);
invariant(
  Number(terrain.tka_path_layout_version) === pathLayout.version,
  `Unexpected Forest path layout version: ${terrain.tka_path_layout_version}`
);
invariant(
  terrain.tka_path_layout_sha256 === pathLayoutSha256,
  "Optimized Forest GLB was not built from the current path layout contract"
);
invariant(
  pathNames.length === pathLayout.paths.length &&
    pathNames.every((name, index) => name === pathLayout.paths[index].name),
  `Unexpected Forest paths: ${pathNames.join(", ")}`
);
invariant(
  pathRoles.filter((role) => role === "stage-to-camp").length === 1 &&
    pathRoles.filter((role) => role === "forest-exit").length === 2 &&
    pathRoles.filter((role) => role === "secondary-loop").length === 1,
  `Unexpected Forest path roles: ${pathRoles.join(", ")}`
);
invariant(
  Number(terrain.tka_root_crossing_count) === pathLayout.rootCrossings.length,
  `Unexpected Forest root crossing count: ${terrain.tka_root_crossing_count}`
);
const treeAssetIds = String(terrain.tka_tree_asset_ids ?? "").split("|");
const treeAssetCounts = Array.from(terrain.tka_tree_asset_counts ?? []).map(
  Number
);
const treeClusterNames = String(terrain.tka_tree_cluster_names ?? "").split(
  "|"
);
invariant(
  terrain.tka_tree_phase === "forest-composition",
  `Unexpected Forest tree phase: ${terrain.tka_tree_phase}`
);
invariant(
  Number(terrain.tka_tree_layout_version) === treeLayout.version,
  `Unexpected Forest tree layout version: ${terrain.tka_tree_layout_version}`
);
invariant(
  terrain.tka_tree_layout_sha256 === treeLayoutSha256,
  "Optimized Forest GLB was not built from the current tree layout contract"
);
invariant(
  Number(terrain.tka_tree_count) === expectedTreeCount,
  `Unexpected Forest tree count: ${terrain.tka_tree_count}`
);
invariant(
  treeAssetIds.length === expectedTreeAssetIds.length &&
    treeAssetIds.every(
      (assetId, index) => assetId === expectedTreeAssetIds[index]
    ),
  `Unexpected Forest tree assets: ${treeAssetIds.join(", ")}`
);
invariant(
  treeAssetCounts.length === expectedTreeAssetIds.length &&
    treeAssetCounts.every(
      (count, index) =>
        count === expectedTreeAssetCounts[expectedTreeAssetIds[index]]
    ),
  `Unexpected Forest tree asset counts: ${treeAssetCounts.join(", ")}`
);
invariant(
  treeClusterNames.length === treeLayout.clusters.length &&
    treeClusterNames.every(
      (name, index) => name === treeLayout.clusters[index].id
    ) &&
    Number(terrain.tka_tree_cluster_count) === treeLayout.clusters.length,
  `Unexpected Forest tree clusters: ${treeClusterNames.join(", ")}`
);
const groundHabitatIds = String(terrain.tka_ground_habitat_ids ?? "").split(
  "|"
);
const groundHabitatCounts = Array.from(
  terrain.tka_ground_habitat_counts ?? []
).map(Number);
const groundVariantIds = String(terrain.tka_ground_variant_ids ?? "").split(
  "|"
);
const groundVariantCounts = Array.from(
  terrain.tka_ground_variant_counts ?? []
).map(Number);
const groundModuleTypes = String(terrain.tka_ground_module_types ?? "").split(
  "|"
);
const groundModuleCounts = Array.from(
  terrain.tka_ground_module_counts ?? []
).map(Number);
invariant(
  terrain.tka_ground_life_phase === "ground-life-ecology",
  `Unexpected Forest ground-life phase: ${terrain.tka_ground_life_phase}`
);
invariant(
  Number(terrain.tka_ground_layout_version) === groundLayout.version,
  `Unexpected Forest ground-life layout version: ${terrain.tka_ground_layout_version}`
);
invariant(
  terrain.tka_ground_layout_sha256 === groundLayoutSha256,
  "Optimized Forest GLB was not built from the current ground-life layout"
);
invariant(
  Number(terrain.tka_ground_ecology_version) === groundEcology.version,
  `Unexpected Forest ground-life ecology version: ${terrain.tka_ground_ecology_version}`
);
invariant(
  terrain.tka_ground_ecology_sha256 === groundEcologySha256,
  "Optimized Forest GLB was not built from the approved ecology contract"
);
invariant(
  Number(terrain.tka_ground_patch_count) === groundLayout.patches.length,
  `Unexpected Forest habitat patch count: ${terrain.tka_ground_patch_count}`
);
invariant(
  Number(terrain.tka_ground_plant_count) >=
    groundLayout.placementRules.minimumPlantInstances,
  `Forest ground life is too sparse: ${terrain.tka_ground_plant_count}`
);
invariant(
  groundHabitatIds.length === expectedGroundHabitatIds.length &&
    groundHabitatIds.every(
      (habitatId, index) => habitatId === expectedGroundHabitatIds[index]
    ) &&
    groundHabitatCounts.length === expectedGroundHabitatIds.length &&
    groundHabitatCounts.every((count) => count > 0),
  `Unexpected Forest ground-life habitats: ${groundHabitatIds.join(", ")}`
);
invariant(
  groundHabitatCounts.reduce((total, count) => total + count, 0) ===
    Number(terrain.tka_ground_plant_count),
  "Forest habitat counts do not match its authored plant count"
);
invariant(
  groundVariantIds.length === expectedGroundVariantIds.length &&
    groundVariantIds.every(
      (variantId, index) => variantId === expectedGroundVariantIds[index]
    ) &&
    groundVariantCounts.length === expectedGroundVariantIds.length &&
    groundVariantCounts.every((count) => count > 0),
  `Unexpected Forest ground-life variants: ${groundVariantIds.join(", ")}`
);
invariant(
  groundVariantCounts.reduce((total, count) => total + count, 0) ===
    Number(terrain.tka_ground_plant_count),
  "Forest variant counts do not match its authored plant count"
);
invariant(
  groundModuleTypes.length === expectedGroundModuleTypes.length &&
    groundModuleTypes.every(
      (moduleType, index) => moduleType === expectedGroundModuleTypes[index]
    ) &&
    groundModuleCounts.length === expectedGroundModuleTypes.length &&
    groundModuleCounts.every((count) => count > 0),
  `Unexpected Forest ground modules: ${groundModuleTypes.join(", ")}`
);
invariant(
  Number(terrain.tka_ground_full_root_island_count) ===
    groundLayout.placementRules.maximumFullRootIslandInstances,
  `Forest circular root island returned: ${terrain.tka_ground_full_root_island_count}`
);
invariant(
  Number(terrain.tka_ground_minimum_clearing_clearance) >=
    groundLayout.placementRules.clearingBufferMetres,
  `Forest ground life entered the clearing: ${terrain.tka_ground_minimum_clearing_clearance}`
);
invariant(
  Number(terrain.tka_ground_minimum_path_core_clearance) >=
    groundLayout.placementRules.pathCoreBufferMetres,
  `Forest ground life entered a path core: ${terrain.tka_ground_minimum_path_core_clearance}`
);
invariant(
  terrain.tka_gpu_instances_required === true,
  "Forest terrain lost its required GPU-instancing contract"
);

const exportedTreeCounts = Object.fromEntries(
  expectedTreeAssetIds.map((assetId) => [assetId, 0])
);
for (const node of instancingNodes) {
  const attributes = node.extensions.EXT_mesh_gpu_instancing.attributes ?? {};
  const translationCount = gltf.accessors?.[attributes.TRANSLATION]?.count;
  const rotationCount = gltf.accessors?.[attributes.ROTATION]?.count;
  const scaleCount = gltf.accessors?.[attributes.SCALE]?.count;
  invariant(
    Number.isInteger(translationCount) && translationCount > 0,
    "Forest instancing node lost TRANSLATION data"
  );
  invariant(
    rotationCount === translationCount,
    "Forest instancing node lost its authored rotation variation"
  );
  invariant(
    scaleCount === translationCount,
    "Forest instancing node lost its authored scale variation"
  );
}
for (const node of treeInstancingNodes) {
  const attributes = node.extensions.EXT_mesh_gpu_instancing.attributes ?? {};
  const translationCount = gltf.accessors?.[attributes.TRANSLATION]?.count;
  const meshName = instancedMeshName(node);
  const assetId = meshName.replace(/^ForestTreeMesh_/, "");
  invariant(
    Object.hasOwn(exportedTreeCounts, assetId),
    `Unexpected instanced Forest tree mesh: ${meshName}`
  );
  exportedTreeCounts[assetId] += translationCount;
}
invariant(
  treeInstancingNodes.length === expectedTreeAssetIds.length,
  `Expected ${expectedTreeAssetIds.length} tree instancing nodes, found ${treeInstancingNodes.length}`
);
for (const assetId of expectedTreeAssetIds) {
  invariant(
    exportedTreeCounts[assetId] === expectedTreeAssetCounts[assetId],
    `Unexpected exported ${assetId} count: ${exportedTreeCounts[assetId]}`
  );
}
const exportedMeshNames = (gltf.meshes ?? []).map((mesh) => mesh.name ?? "");
for (const family of groundEcology.families.filter(
  (candidate) => candidate.id !== "mushroom"
)) {
  for (const variant of family.variants) {
    const expectedMeshName = `ForestGroundLifeVariantMesh_${family.id}-${variant}`;
    invariant(
      exportedMeshNames.includes(expectedMeshName),
      `Forest GLB lost ground-life source mesh: ${expectedMeshName}`
    );
  }
}
invariant(
  exportedMeshNames.includes(
    "ForestGroundLifeVariantMesh_mushroom-mature-colony"
  ),
  "Forest GLB lost the mature mushroom-colony source mesh"
);
for (const mushroomPart of ["stem", "cap-honey", "cap-chestnut", "cap-spent"]) {
  invariant(
    exportedMeshNames.includes(`ForestGroundMushroomMesh_${mushroomPart}`),
    `Forest GLB lost procedural mushroom mesh: ${mushroomPart}`
  );
}
for (const moduleType of expectedGroundModuleTypes) {
  invariant(
    exportedMeshNames.some((name) =>
      name.startsWith(`ForestGroundModuleMesh_${moduleType}-`)
    ),
    `Forest GLB lost ground module mesh: ${moduleType}`
  );
}
invariant(
  groundVariantInstancingNodes.length >= 13,
  `Forest GLB lost plant-family instancing: ${groundVariantInstancingNodes.length}`
);
invariant(
  groundMushroomInstancingNodes.length === 4,
  `Forest GLB lost procedural mushroom instancing: ${groundMushroomInstancingNodes.length}`
);
invariant(
  groundModuleInstancingNodes.length > 0,
  "Forest GLB lost repeated habitat-module instancing"
);
invariant(
  Number(terrain.tka_clearing_edge_min_radius) >= pathLayout.clearingRadius &&
    Number(terrain.tka_clearing_edge_max_radius) -
      Number(terrain.tka_clearing_edge_min_radius) >=
      2.5,
  "Forest clearing edge lost its irregular buffer around the performance area"
);
for (const material of (gltf.materials ?? []).filter((candidate) =>
  expectedMaterialZones.includes(candidate.name)
)) {
  invariant(
    material.pbrMetallicRoughness?.baseColorTexture?.texCoord === 1,
    `${material.name} lost its world-scale macro UV`
  );
  invariant(
    (material.normalTexture?.texCoord ?? 0) === 0,
    `${material.name} normal map lost its repeating detail UV`
  );
  invariant(
    (material.pbrMetallicRoughness?.metallicRoughnessTexture?.texCoord ?? 0) ===
      0,
    `${material.name} roughness map lost its repeating detail UV`
  );
}
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
const document = await io.read(glbPath);
const root = document.getRoot();
const decodedTerrain = root
  .listNodes()
  .find((node) => node.getExtras()?.tka_role === "terrain");
const decodedMesh = decodedTerrain?.getMesh();
invariant(decodedMesh, "Decoded Forest terrain mesh is missing");
const terrainWorldMatrix = decodedTerrain.getWorldMatrix();

function transformPoint([x, y, z], matrix) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

const vertices = [];
const materialTriangles = new Map();
for (const primitive of decodedMesh.listPrimitives()) {
  const positions = primitive.getAttribute("POSITION");
  invariant(positions, "Forest terrain primitive lost POSITION data");
  const localPosition = [];
  for (let index = 0; index < positions.getCount(); index += 1) {
    positions.getElement(index, localPosition);
    vertices.push(transformPoint(localPosition, terrainWorldMatrix));
  }
  const materialName = primitive.getMaterial()?.getName() ?? "(none)";
  const triangleCount =
    (primitive.getIndices()?.getCount() ?? positions.getCount()) / 3;
  materialTriangles.set(
    materialName,
    (materialTriangles.get(materialName) ?? 0) + triangleCount
  );
}

for (const zoneName of expectedMaterialZones) {
  invariant(
    (materialTriangles.get(zoneName) ?? 0) > 0,
    `Optimized Forest GLB lost material zone: ${zoneName}`
  );
}

const clearingRadius = Number(terrain.tka_clearing_radius);
const maximumFlatDeviation = vertices
  .filter(([x, , z]) => Math.hypot(x, z) <= clearingRadius + 0.001)
  .reduce((maximum, [, y]) => Math.max(maximum, Math.abs(y)), 0);
invariant(
  maximumFlatDeviation <= 0.02,
  `Optimized Forest clearing is not flat: ${maximumFlatDeviation.toFixed(4)}m`
);

const angularSegments = Number(terrain.tka_angular_segments);
const rays = Array.from({ length: angularSegments }, () => []);
for (const [x, y, z] of vertices) {
  const radius = Math.hypot(x, z);
  if (radius < 1) continue;
  const angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
  const segment =
    Math.round((angle / (Math.PI * 2)) * angularSegments) % angularSegments;
  rays[segment].push({ radius, height: y });
}
invariant(
  rays.every((ray) => ray.length > 0),
  "Optimized Forest terrain lost one or more radial segments"
);

const edgeSamples = rays.map((ray) =>
  ray.reduce((edge, sample) => (sample.radius > edge.radius ? sample : edge))
);
const actualMinimumRadius = Math.min(
  ...edgeSamples.map((sample) => sample.radius)
);
const actualMaximumRadius = Math.max(
  ...edgeSamples.map((sample) => sample.radius)
);
const skirtDrops = rays.map((ray, index) => {
  const edge = edgeSamples[index];
  const targetRadius = edge.radius * 0.84;
  const inner = ray.reduce((closest, sample) =>
    Math.abs(sample.radius - targetRadius) <
    Math.abs(closest.radius - targetRadius)
      ? sample
      : closest
  );
  return inner.height - edge.height;
});
const actualMinimumSkirtDrop = Math.min(...skirtDrops);
invariant(
  actualMinimumRadius >= 148,
  `Optimized terrain envelope is too small: ${actualMinimumRadius.toFixed(3)}m`
);
invariant(
  actualMaximumRadius - actualMinimumRadius >= 20,
  "Optimized terrain boundary lost its irregular silhouette"
);
invariant(
  actualMinimumSkirtDrop >= 10,
  `Optimized terrain skirt is too shallow: ${actualMinimumSkirtDrop.toFixed(3)}m`
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
        clearingRadius,
        maximumFlatDeviation,
        minimumRadius: actualMinimumRadius,
        maximumRadius: actualMaximumRadius,
        minimumSkirtDrop: actualMinimumSkirtDrop,
      },
      materialZones: Object.fromEntries(materialTriangles),
      paths: {
        layoutVersion: pathLayout.version,
        layoutSha256: pathLayoutSha256,
        names: pathNames,
        roles: pathRoles,
        rootCrossings: Number(terrain.tka_root_crossing_count),
        clearingEdgeRadius: [
          Number(terrain.tka_clearing_edge_min_radius),
          Number(terrain.tka_clearing_edge_max_radius),
        ],
      },
      trees: {
        layoutVersion: treeLayout.version,
        layoutSha256: treeLayoutSha256,
        count: expectedTreeCount,
        clusters: treeClusterNames,
        assetCounts: exportedTreeCounts,
        instancingNodes: treeInstancingNodes.length,
        transformAttributes: ["TRANSLATION", "ROTATION", "SCALE"],
      },
      groundLife: {
        layoutVersion: groundLayout.version,
        layoutSha256: groundLayoutSha256,
        ecologyVersion: groundEcology.version,
        ecologySha256: groundEcologySha256,
        patches: Number(terrain.tka_ground_patch_count),
        plants: Number(terrain.tka_ground_plant_count),
        habitatCounts: Object.fromEntries(
          groundHabitatIds.map((habitatId, index) => [
            habitatId,
            groundHabitatCounts[index],
          ])
        ),
        variantCounts: Object.fromEntries(
          groundVariantIds.map((variantId, index) => [
            variantId,
            groundVariantCounts[index],
          ])
        ),
        moduleCounts: Object.fromEntries(
          groundModuleTypes.map((moduleType, index) => [
            moduleType,
            groundModuleCounts[index],
          ])
        ),
        minimumClearingClearanceMetres: Number(
          terrain.tka_ground_minimum_clearing_clearance
        ),
        minimumPathCoreClearanceMetres: Number(
          terrain.tka_ground_minimum_path_core_clearance
        ),
        fullRootIslandInstances: Number(
          terrain.tka_ground_full_root_island_count
        ),
        instancingNodes: {
          sourceVariants: groundVariantInstancingNodes.length,
          proceduralMushrooms: groundMushroomInstancingNodes.length,
          repeatedModules: groundModuleInstancingNodes.length,
        },
      },
    },
    null,
    2
  )
);
