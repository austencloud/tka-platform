#!/usr/bin/env node
/** Verify the removable close-frame layer for the Moonlit Firefly Forest. */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const glbPath = resolve("static/models/forest/forest-near-frame.glb");
const rawGlbPath = resolve("static/models/forest/forest-near-frame_raw.glb");
const layoutPath = resolve("scripts/forest-static-prop-layout.json");
const layoutBytes = readFileSync(layoutPath);
const layout = JSON.parse(layoutBytes.toString("utf8"));
const layoutSha256 = createHash("sha256").update(layoutBytes).digest("hex");
const compositionPath = resolve(layout.compositionContractPath);
const compositionBytes = readFileSync(compositionPath);
const composition = JSON.parse(compositionBytes.toString("utf8"));
const compositionSha256 = createHash("sha256")
  .update(compositionBytes)
  .digest("hex");
const metricsPath = join(
  tmpdir(),
  "tka-forest-evidence",
  "forest_near_frame_metrics.json"
);
const metrics = JSON.parse(readFileSync(metricsPath, "utf8"));
const maximumBytes = 18 * 1024 * 1024;
const meadowSystemVersion = 10;
const groundEcosystemVersion = 7;

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
const authoredNodes = (gltf.nodes ?? []).filter(
  (node) => node.extras?.tka_export_layer === "near-frame"
);
const treeNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "near-frame-tree"
);
const propNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "near-frame-static-prop"
);
const grassNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "near-frame-ground-ecosystem"
);
const trailNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "near-frame-trail"
);
const shelfNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "camp-shelf"
);
const mushroomNodes = authoredNodes.filter(
  (node) => node.extras?.tka_role === "near-frame-mushroom-part"
);
const rawMushroomNodes = (rawGltf.nodes ?? []).filter(
  (node) => node.extras?.tka_role === "near-frame-mushroom-part"
);
const instancedMushroomCount = (gltf.nodes ?? []).reduce((count, node) => {
  const translationAccessor =
    node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
  const meshName = gltf.meshes?.[node.mesh]?.name ?? "";
  if (
    !Number.isInteger(translationAccessor) ||
    !meshName.startsWith("ForestGroundMushroomMesh_")
  ) {
    return count;
  }
  return count + Number(gltf.accessors?.[translationAccessor]?.count ?? 0);
}, 0);
const instancedGrassCount = (gltf.nodes ?? []).reduce((count, node) => {
  const translationAccessor =
    node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION;
  const meshName = gltf.meshes?.[node.mesh]?.name ?? "";
  if (
    !Number.isInteger(translationAccessor) ||
    !meshName.startsWith("ForestEcosystemMesh_")
  ) {
    return count;
  }
  return count + Number(gltf.accessors?.[translationAccessor]?.count ?? 0);
}, 0);
const authoredGrassCount = (gltf.nodes ?? []).reduce((count, node) => {
  if (node.extras?.tka_role !== "near-frame-ground-ecosystem") return count;
  return count + Number(node.extras?.tka_grass_clumps ?? 0);
}, 0);
const expectedTrees = layout.frameTrees;
const expectedProps = [
  ...layout.vignettes.flatMap((vignette) =>
    vignette.props.map((prop) => ({ ...prop, vignetteId: vignette.id }))
  ),
  ...layout.zoneProps.map((prop) => ({
    ...prop,
    vignetteId: prop.habitatZoneId,
  })),
];
const expectedTreeIds = new Set(expectedTrees.map((tree) => tree.id));
const expectedPropIds = new Set(expectedProps.map((prop) => prop.id));
const expectedVignetteIds = new Set([
  ...layout.vignettes.map(({ id }) => id),
  ...layout.zoneProps.map(({ habitatZoneId }) => habitatZoneId),
]);
const expectedHabitatZoneIds = new Set(
  layout.zoneProps.map(({ habitatZoneId }) => habitatZoneId)
);
const expectedGrassPatchIds = new Set(layout.grassPatches.map(({ id }) => id));
const expectedGrassTiers = new Set(["base"]);
const expectedGroundSpecies = new Set(
  Object.values(layout.groundEcosystem.patchGuilds).flat()
);
const expectedMushroomColonyIds = new Set(
  layout.mushroomColonies.map(({ id }) => id)
);
const sourceMeshById = new Map();

invariant(bytes <= maximumBytes, `GLB exceeds ${maximumBytes} bytes: ${bytes}`);
invariant(gltf.scenes?.length === 1, "GLB must contain exactly one scene");
invariant((gltf.cameras?.length ?? 0) === 0, "QA cameras leaked into the GLB");
invariant(
  (gltf.extensions?.KHR_lights_punctual?.lights?.length ?? 0) === 0,
  "QA lights leaked into the GLB"
);
invariant(
  extensions.has("KHR_draco_mesh_compression"),
  "Near-frame GLB lost Draco compression"
);
invariant(
  extensions.has("EXT_texture_webp"),
  "Near-frame GLB textures are not WebP encoded"
);
invariant(
  authoredNodes.length ===
    expectedTrees.length +
      expectedProps.length +
      grassNodes.length +
      mushroomNodes.length +
      trailNodes.length +
      shelfNodes.length,
  "Near-frame authored-node classification is incomplete"
);
invariant(
  treeNodes.length === expectedTrees.length,
  `Expected ${expectedTrees.length} frame trees, found ${treeNodes.length}`
);
invariant(
  propNodes.length === expectedProps.length,
  `Expected ${expectedProps.length} static props, found ${propNodes.length}`
);
invariant(
  instancedGrassCount > 0,
  "Expected GPU-instanced ecosystem populations"
);
invariant(
  grassNodes.every((node) => {
    const species = node.extras?.tka_ground_species;
    const isContinuousTurf =
      species === "summer-sward" || species === "woodland-grass";
    const isInstanced = Boolean(
      node.extensions?.EXT_mesh_gpu_instancing?.attributes?.TRANSLATION != null
    );
    return isContinuousTurf ? isInstanced : true;
  }),
  "Continuous turf lost GPU instancing"
);
invariant(
  trailNodes.length === 1,
  "Near-frame must contain one worn trail accent"
);
invariant(
  shelfNodes.length === 1,
  "Near-frame must contain one approved camp shelf"
);
invariant(
  mushroomNodes.length + instancedMushroomCount ===
    Number(metrics.groundLife.mushroomPartCount),
  "Near-frame mushroom parts do not match builder metrics"
);

for (const node of authoredNodes) {
  const extras = node.extras;
  invariant(
    Number(extras.tka_static_prop_layout_version) === layout.version,
    `${node.name} has the wrong layout version`
  );
  invariant(
    extras.tka_static_prop_layout_sha256 === layoutSha256,
    `${node.name} was not built from the current layout`
  );
  invariant(Number.isInteger(node.mesh), `${node.name} lost its mesh`);
}

for (const node of treeNodes) {
  invariant(
    expectedTreeIds.has(node.extras.tka_frame_tree_id),
    `Unexpected frame tree: ${node.extras.tka_frame_tree_id}`
  );
}
for (const node of propNodes) {
  const extras = node.extras;
  invariant(
    expectedPropIds.has(extras.tka_static_prop_id),
    `Unexpected static prop: ${extras.tka_static_prop_id}`
  );
  invariant(
    expectedVignetteIds.has(extras.tka_static_prop_vignette),
    `Unexpected vignette: ${extras.tka_static_prop_vignette}`
  );
  const priorMesh = sourceMeshById.get(extras.tka_static_prop_source);
  if (priorMesh != null) {
    invariant(
      priorMesh === node.mesh,
      `Repeated source ${extras.tka_static_prop_source} lost mesh reuse`
    );
  } else {
    sourceMeshById.set(extras.tka_static_prop_source, node.mesh);
  }
}

const actualHabitatZoneIds = new Set(
  propNodes.map((node) => node.extras.tka_habitat_zone_id).filter(Boolean)
);
invariant(
  [...expectedHabitatZoneIds].every((id) => actualHabitatZoneIds.has(id)),
  "Near-frame props lost one or more authored habitat-zone identities"
);

const shelfNode = shelfNodes[0];
invariant(
  Number(shelfNode.extras.tka_composition_layout_version) ===
    composition.version &&
    shelfNode.extras.tka_composition_layout_sha256 === compositionSha256,
  "Camp shelf was not built from the approved composition contract"
);

const actualGrassPatchIds = new Set(
  grassNodes.flatMap((node) =>
    String(node.extras.tka_grass_patch_ids ?? "")
      .split("|")
      .filter(Boolean)
  )
);
const actualGrassTiers = new Set(
  grassNodes.map((node) => node.extras.tka_grass_quality_tier)
);
const grassNodeClumps = grassNodes.reduce(
  (sum, node) => sum + Number(node.extras.tka_grass_clumps ?? 0),
  0
);
const actualGroundSpecies = new Set(
  grassNodes.map((node) => node.extras.tka_ground_species).filter(Boolean)
);
const actualGroundStrata = new Set(
  grassNodes.map((node) => node.extras?.tka_ground_stratum).filter(Boolean)
);

invariant(
  grassNodes.every(
    (node) =>
      Number(node.extras.tka_meadow_system_version) === meadowSystemVersion
  ),
  "Near-frame plants did not come from the approved ecosystem builder"
);
invariant(
  grassNodes.every(
    (node) =>
      Number(node.extras.tka_ground_ecosystem_version) ===
      groundEcosystemVersion
  ),
  "Near-frame plants lost the ground-ecosystem contract"
);
invariant(
  [...expectedGrassTiers].every((tier) => actualGrassTiers.has(tier)),
  "Near-frame grass lost one or more cumulative quality tiers"
);
invariant(
  grassNodeClumps === Number(metrics.groundLife.grassClumpCount),
  "Meadow mesh clump totals do not match builder metrics"
);
invariant(
  Object.values(metrics.groundLife.grassTierCounts).reduce(
    (sum, count) => sum + Number(count),
    0
  ) === Number(metrics.groundLife.grassClumpCount),
  "Meadow quality-tier metrics do not sum to the authored clump total"
);
invariant(
  Number(metrics.groundLife.groundEcosystem.turfFloor?.coverageSamples ?? 0) >=
    90_000,
  "Continuous turf floor lost the minimum production coverage"
);
invariant(
  Number(metrics.groundLife.groundEcosystem.familyCounts.grass ?? 0) >=
    Number(metrics.groundLife.groundEcosystem.instanceCount ?? 0),
  "The ground population contains non-grass foliage islands"
);
invariant(
  [...expectedGroundSpecies].every((species) =>
    actualGroundSpecies.has(species)
  ),
  "Ground ecosystem lost one or more approved scanned species"
);
invariant(
  ["worn", "carpet", "meadow", "seed"].every((stratum) =>
    actualGroundStrata.has(stratum)
  ),
  "Continuous turf lost one or more grass-only structural strata"
);
invariant(
  Number(
    metrics.groundLife.groundEcosystem.turfFloor?.compressedTrafficSamples ?? 0
  ) > 0,
  "Path and camp edges lost their compressed-grass transition"
);
invariant(
  Number(metrics.groundLife.groundEcosystem.turfFloor?.pathSamples ?? -1) === 0,
  "Path cores must not delete grass samples"
);
invariant(
  Number(
    metrics.groundLife.groundEcosystem.turfFloor?.retainedPathCoreSamples ?? 0
  ) > 0,
  "Path cores lost their flattened living-grass layer"
);
const pathCoreRetention = Number(
  metrics.groundLife.groundEcosystem.turfFloor?.pathCoreRetention ?? 0
);
invariant(
  pathCoreRetention >= 0.58 && pathCoreRetention <= 0.74,
  `Path core retention must stay between 58% and 74%: ${pathCoreRetention}`
);
const pathCoreSideCandidates =
  metrics.groundLife.groundEcosystem.turfFloor?.pathCoreSideCandidates ?? {};
const retainedPathCoreSideSamples =
  metrics.groundLife.groundEcosystem.turfFloor?.retainedPathCoreSideSamples ??
  {};
invariant(
  Number(pathCoreSideCandidates.left ?? 0) > 0 &&
    Number(pathCoreSideCandidates.right ?? 0) > 0,
  "Lived-in paths lost one side of their asymmetric traffic field"
);
invariant(
  Number(retainedPathCoreSideSamples.left ?? 0) > 0 &&
    Number(retainedPathCoreSideSamples.right ?? 0) > 0,
  "Flattened path grass must survive on both sides of the travelled line"
);

invariant(
  trailNodes[0].extras.tka_trail_accent_id === layout.trailAccent.id &&
    trailNodes[0].extras.tka_trail_path_id === layout.trailAccent.pathId,
  "Near-frame trail accent drifted from its authored path contract"
);
invariant(
  Number(metrics.groundLife.trail.sampleCount) >= 8,
  "Near-frame trail accent has too few samples to follow the path"
);
invariant(
  [...expectedGrassPatchIds].every(
    (id) => Number(metrics.groundLife.groundEcosystem.patchCounts[id] ?? 0) > 0
  ),
  "Ground ecosystem lost one or more authored habitat patches"
);

const actualMushroomColonyIds = new Set(
  rawMushroomNodes.map((node) => node.extras.tka_mushroom_colony_id)
);
invariant(
  [...expectedMushroomColonyIds].every((id) => actualMushroomColonyIds.has(id)),
  "Near-frame mushrooms lost one or more authored colonies"
);

invariant(
  Number(metrics.frameTreeCount) === expectedTrees.length,
  "Builder metrics do not match the frame-tree contract"
);
invariant(
  Number(metrics.propCount) === expectedProps.length,
  "Builder metrics do not match the static-prop contract"
);
invariant(
  Number(metrics.zonePropCount) === layout.zoneProps.length,
  "Builder metrics do not match the habitat-zone prop contract"
);
invariant(
  Number(metrics.campShelf.maximumApproachGradePercent) <=
    composition.campRelocation.shelf.maximumApproachGradePercent,
  "Camp shelf exceeds the approved approach grade"
);
invariant(
  Number(metrics.minimumPathShoulderMarginMetres) >=
    layout.rules.minimumPathShoulderMarginMetres,
  "Static props entered a protected path shoulder"
);
invariant(
  Number(metrics.minimumCampfireCenterDistanceMetres) >=
    layout.rules.minimumCampfireCenterDistanceMetres,
  "Static props entered the campfire safety pocket"
);
invariant(
  Number(metrics.maximumPropAnchorDistanceMetres) <=
    layout.rules.maximumPropDistanceFromAnchorMetres,
  "A static prop became detached from its vignette anchor"
);

console.log(
  JSON.stringify(
    {
      glbPath,
      bytes,
      layoutVersion: layout.version,
      layoutSha256,
      frameTrees: treeNodes.map((node) => node.extras.tka_frame_tree_id),
      staticProps: propNodes.map((node) => node.extras.tka_static_prop_id),
      vignettes: [...expectedVignetteIds],
      habitatZones: [...expectedHabitatZoneIds],
      campShelf: metrics.campShelf,
      grassPatches: [...expectedGrassPatchIds],
      grassClumps: metrics.groundLife.grassClumpCount,
      grassTiers: metrics.groundLife.grassTierCounts,
      ecosystemVersion: metrics.groundLife.groundEcosystem.version,
      ecosystemSpecies: metrics.groundLife.groundEcosystem.speciesCounts,
      ecosystemStrata:
        metrics.groundLife.groundEcosystem.turfFloor.stratumCounts,
      ecosystemFamilies: metrics.groundLife.groundEcosystem.familyCounts,
      authoredGroundPopulations: authoredGrassCount,
      instancedGroundPopulations: instancedGrassCount,
      trail: metrics.groundLife.trail,
      mushroomColonies: [...expectedMushroomColonyIds],
      mushroomParts: mushroomNodes.length + instancedMushroomCount,
      instancedMushroomParts: instancedMushroomCount,
      sharedSourceMeshes: Object.fromEntries(sourceMeshById),
      margins: {
        pathShoulderMetres: metrics.minimumPathShoulderMarginMetres,
        campfireCenterMetres: metrics.minimumCampfireCenterDistanceMetres,
        maximumAnchorDistanceMetres: metrics.maximumPropAnchorDistanceMetres,
      },
      extensions: [...extensions],
    },
    null,
    2
  )
);
