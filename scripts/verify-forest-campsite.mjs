#!/usr/bin/env node
/** Verify the approved Forest campsite artifact and measured layout contract. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const glbPath = resolve("static/models/forest/forest-campsite.glb");
const layoutPath = resolve("scripts/forest-campsite-layout.json");
const meshyManifestPath = resolve("scripts/forest-campsite-meshy-images.json");
const layoutBytes = readFileSync(layoutPath);
const layout = JSON.parse(layoutBytes.toString("utf8"));
const meshyManifest = JSON.parse(readFileSync(meshyManifestPath, "utf8"));
const layoutSha256 = createHash("sha256").update(layoutBytes).digest("hex");
const metricsPath = join(
  tmpdir(),
  "tka-forest-evidence",
  "forest_campsite_metrics.json"
);
const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));

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
const authoredNodes = (gltf.nodes ?? []).filter(
  (node) =>
    node.extras?.tka_export_layer === "forest-campsite" &&
    Number.isInteger(node.mesh)
);
const itemIds = new Set(
  authoredNodes.map((node) => node.extras?.tka_campsite_item)
);
const roleCounts = authoredNodes.reduce((counts, node) => {
  const role = node.extras?.tka_role;
  counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}, {});
const tentNodes = authoredNodes.filter((node) => node.extras?.tka_role === "tent");
const tentMaterialIndexes = new Set(
  tentNodes.flatMap((node) =>
    (gltf.meshes?.[node.mesh]?.primitives ?? [])
      .map((primitive) => primitive.material)
      .filter(Number.isInteger)
  )
);
const tentMaterials = [...tentMaterialIndexes].map((index) => gltf.materials?.[index]);

function textureImageName(textureInfo) {
  const texture = gltf.textures?.[textureInfo?.index];
  const sourceIndex = texture?.extensions?.EXT_texture_webp?.source ?? texture?.source;
  return gltf.images?.[sourceIndex]?.name;
}

const expectedItems = new Set([
  ...layout.tents.flatMap((tent) => [tent.id, `${tent.id}-pad`]),
  "modern-smokeless-fire-pit",
  ...layout.communalZone.chairAnglesDegrees.map((_, index) =>
    `chair-${index + 1}`
  ),
]);
const sourceMetricsById = new Map(
  metrics.sourceMetrics.map((sourceMetric) => [sourceMetric.id, sourceMetric])
);
const meshyAssetsById = new Map(
  meshyManifest.assets.map((asset) => [asset.id, asset])
);

invariant(
  bytes <= layout.production.maximumAssetBytes,
  `Forest campsite exceeds ${layout.production.maximumAssetBytes} bytes: ${bytes}`
);
invariant(gltf.scenes?.length === 1, "Forest campsite must contain one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the campsite GLB");
invariant(
  (gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0) === 0,
  "QA lights leaked into the campsite GLB"
);
invariant(
  extensions.has("EXT_meshopt_compression"),
  "Forest campsite lost meshopt compression"
);
invariant(authoredNodes.length > 0, "Forest campsite contains no authored renderable nodes");
for (const itemId of expectedItems) {
  invariant(itemIds.has(itemId), `Forest campsite lost ${itemId}`);
}
for (const role of layout.production.roles) {
  invariant((roleCounts[role] ?? 0) > 0, `Forest campsite lost the ${role} role`);
}
for (const node of authoredNodes) {
  invariant(
    Number(node.extras.tka_campsite_layout_version) === layout.version,
    `${node.name} has the wrong campsite layout version`
  );
  invariant(
    node.extras.tka_campsite_layout_sha256 === layoutSha256,
    `${node.name} was not built from the current campsite layout`
  );
}
invariant(tentMaterials.length === 3, "Forest campsite must retain one graded material per tent");
for (const material of tentMaterials) {
  invariant(
    material?.name?.startsWith("Forest Tent Clean Ripstop "),
    `Uncorrected Meshy tent material survived export: ${material?.name ?? "unnamed"}`
  );
  invariant(
    material.pbrMetallicRoughness?.baseColorTexture,
    `${material.name} lost its corrected albedo atlas`
  );
  invariant(
    textureImageName(material.pbrMetallicRoughness.baseColorTexture) ===
      "ripstop-neutral-v1",
    `${material.name} is not using the clean ripstop source`
  );
  invariant(
    material.pbrMetallicRoughness?.metallicFactor === 0,
    `${material.name} must remain nonmetallic`
  );
  invariant(
    material.pbrMetallicRoughness?.roughnessFactor >= 0.9,
    `${material.name} is too glossy for ripstop fabric`
  );
  invariant(
    material.emissiveTexture === undefined,
    `${material.name} retained a baked emissive atlas`
  );
  invariant(
    material.emissiveFactor?.every((channel) => channel > 0 && channel <= 0.04),
    `${material.name} lost its restrained uniform night lift`
  );
}

invariant(metrics.layoutVersion === layout.version, "Campsite metrics version drifted");
invariant(metrics.layoutSha256 === layoutSha256, "Campsite metrics hash drifted");
invariant(metrics.tentCount === 3, "The approved three-tent family is incomplete");
invariant(metrics.totalSleepingCapacity === 6, "Campsite sleeping capacity drifted");
for (const tent of layout.tents) {
  const sourceMetric = sourceMetricsById.get(tent.id);
  const sourceAsset = meshyAssetsById.get(tent.id);
  invariant(sourceMetric, `Campsite metrics lost ${tent.id}`);
  invariant(sourceAsset, `Meshy manifest lost ${tent.id}`);
  invariant(
    sourceMetric.normalizationMode === "measured-target-bounds",
    `${tent.id} reverted to height-only scaling`
  );
  const expectedDimensions = [
    tent.footprint[0],
    tent.footprint[1],
    sourceAsset.targetHeightMetres,
  ];
  invariant(
    sourceMetric.finalDimensions.every(
      (dimension, index) => Math.abs(dimension - expectedDimensions[index]) <= 0.01
    ),
    `${tent.id} missed its measured dimensions: ${sourceMetric.finalDimensions.join(" x ")}`
  );
  invariant(
    tent.padFootprint[0] >= sourceMetric.finalDimensions[0] &&
      tent.padFootprint[1] >= sourceMetric.finalDimensions[1],
    `${tent.id} exceeds its durable sleeping pad`
  );
}
invariant(
  metrics.chairCount === layout.communalZone.chairAnglesDegrees.length,
  "The approved chair arc is incomplete"
);
invariant(
  metrics.stageToFireCenterMetres >=
    layout.siteLogic.minimumStageToFireCenterMetres,
  "The campsite social core crowds the performance bowl"
);
invariant(
  metrics.tentSafety.every((tent) => tent.safetyMarginMetres >= 0),
  "A tent entered the measured fire safety buffer"
);
invariant(
  JSON.stringify(metrics.runtimeOwnersPreserved) ===
    JSON.stringify(["volumetric fire", "smoke", "primary light", "fill light"]),
  "The campsite geometry took ownership of runtime fire effects"
);

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes,
      layoutVersion: layout.version,
      layoutSha256,
      authoredNodes: authoredNodes.length,
      itemIds: [...itemIds].sort(),
      roleCounts,
      tentMaterials: tentMaterials.map((material) => ({
        name: material.name,
        baseColorTexture: textureImageName(
          material.pbrMetallicRoughness.baseColorTexture
        ),
        metallicFactor: material.pbrMetallicRoughness.metallicFactor,
        roughnessFactor: material.pbrMetallicRoughness.roughnessFactor,
        emissiveFactor: material.emissiveFactor,
      })),
      tentDimensions: layout.tents.map((tent) => ({
        id: tent.id,
        finalDimensions: sourceMetricsById.get(tent.id).finalDimensions,
        padFootprint: tent.padFootprint,
      })),
      tentSafety: metrics.tentSafety,
      stageToFireCenterMetres: metrics.stageToFireCenterMetres,
      runtimeOwnersPreserved: metrics.runtimeOwnersPreserved,
      extensions: [...extensions],
    },
    null,
    2
  )
);
