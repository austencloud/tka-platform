#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const layoutPath = resolve("scripts/forest-ground-life-layout.json");
const ecologyPath = resolve("scripts/forest-ground-life-ecology.json");
const pathLayoutPath = resolve("scripts/forest-path-layout.json");
const evidenceDirectory = resolve(tmpdir(), "tka-forest-evidence");
const metricsPath = resolve(
  evidenceDirectory,
  "forest_environment_ground_life_metrics.json"
);
const boardPath = resolve(
  evidenceDirectory,
  "ground-life-layout",
  "forest_ground_life_gate7_board.png"
);

const [layoutBytes, ecologyBytes, pathLayoutBytes, metrics] = await Promise.all(
  [
    readFile(layoutPath),
    readFile(ecologyPath),
    readFile(pathLayoutPath),
    readFile(metricsPath, "utf8").then(JSON.parse),
  ]
);
const layout = JSON.parse(layoutBytes.toString("utf8"));
const ecology = JSON.parse(ecologyBytes.toString("utf8"));
const pathLayout = JSON.parse(pathLayoutBytes.toString("utf8"));
const layoutSha256 = createHash("sha256").update(layoutBytes).digest("hex");
const ecologySha256 = createHash("sha256").update(ecologyBytes).digest("hex");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values) {
  return new Set(values).size === values.length;
}

invariant(layout.version === 1, `Unexpected layout version: ${layout.version}`);
invariant(
  metrics.layoutVersion === layout.version &&
    metrics.layoutSha256 === layoutSha256,
  "Ground-life metrics were not built from the current placement layout"
);
invariant(
  metrics.ecologyVersion === ecology.version &&
    metrics.ecologySha256 === ecologySha256,
  "Ground-life metrics were not built from the approved ecology contract"
);
invariant(
  layout.ecologyContractPath === "scripts/forest-ground-life-ecology.json",
  `Unexpected ecology owner: ${layout.ecologyContractPath}`
);

const patchIds = layout.patches.map((patch) => patch.id);
const patchSeeds = layout.patches.map((patch) => patch.seed);
const habitatIds = ecology.habitats.map((habitat) => habitat.id);
const pathIds = new Set(pathLayout.paths.map((path) => path.id));
const rootCrossingIds = new Set(
  pathLayout.rootCrossings.map((crossing) => crossing.id)
);
invariant(unique(patchIds), "Ground-life patch IDs must be unique");
invariant(unique(patchSeeds), "Ground-life patch seeds must be unique");
invariant(
  layout.patches.length >= layout.placementRules.minimumHabitatPatches,
  `Too few ground-life patches: ${layout.patches.length}`
);
for (const habitatId of habitatIds) {
  invariant(
    layout.patches.filter((patch) => patch.habitatId === habitatId).length >= 3,
    `Habitat needs at least three site-specific patches: ${habitatId}`
  );
}
for (const patch of layout.patches) {
  invariant(
    habitatIds.includes(patch.habitatId),
    `Unknown habitat on patch ${patch.id}: ${patch.habitatId}`
  );
  invariant(
    patch.radii.every((radius) => Number(radius) > 0),
    `Patch has invalid radii: ${patch.id}`
  );
  if (patch.pathId) {
    invariant(pathIds.has(patch.pathId), `Unknown path on ${patch.id}`);
  }
  if (patch.rootCrossingId) {
    invariant(
      rootCrossingIds.has(patch.rootCrossingId),
      `Unknown root crossing on ${patch.id}`
    );
  }
}

invariant(
  metrics.patchCount === layout.patches.length,
  `Unexpected rendered patch count: ${metrics.patchCount}`
);
invariant(
  metrics.plantInstanceCount >= layout.placementRules.minimumPlantInstances,
  `Ground life is too sparse: ${metrics.plantInstanceCount}`
);
invariant(
  metrics.fullRootIslandInstances ===
    layout.placementRules.maximumFullRootIslandInstances,
  `Circular root island returned: ${metrics.fullRootIslandInstances}`
);
invariant(
  metrics.minimumClearingClearanceMetres >=
    layout.placementRules.clearingBufferMetres,
  `Ground life entered the clearing: ${metrics.minimumClearingClearanceMetres}`
);
invariant(
  metrics.minimumPathCoreClearanceMetres >=
    layout.placementRules.pathCoreBufferMetres,
  `Ground life entered a path core: ${metrics.minimumPathCoreClearanceMetres}`
);
invariant(
  metrics.maximumTreeAnchorDistanceMetres <=
    layout.placementRules.maximumTreeAnchorDistanceMetres,
  `A habitat patch lost canopy contact: ${metrics.maximumTreeAnchorDistanceMetres}`
);

const expectedVariantIds = ecology.families.flatMap((family) =>
  family.variants.map((variant) => `${family.id}-${variant}`)
);
invariant(
  expectedVariantIds.length >= layout.placementRules.minimumVariantCoverage,
  "Approved ecology contract does not expose enough family variants"
);
for (const variantId of expectedVariantIds) {
  invariant(
    Number(metrics.variantCounts[variantId]) > 0,
    `Production placement lost variant: ${variantId}`
  );
}
for (const moduleType of ecology.groundModules) {
  invariant(
    Number(metrics.moduleCounts[moduleType]) > 0,
    `Production placement lost ground module: ${moduleType}`
  );
}

invariant(
  metrics.patches.map((patch) => patch.id).join("|") === patchIds.join("|"),
  "Ground-life metrics lost patch order or coverage"
);
for (const metric of metrics.patches) {
  const patch = layout.patches.find((candidate) => candidate.id === metric.id);
  const habitat = ecology.habitats.find(
    (candidate) => candidate.id === patch.habitatId
  );
  invariant(
    metric.premise === habitat.premise,
    `Premise drift on ${metric.id}`
  );
  invariant(
    metric.negativeSpaceFraction === habitat.negativeSpaceFraction,
    `Negative-space target drift on ${metric.id}`
  );
  invariant(metric.plantCount >= 6, `Patch is too empty: ${metric.id}`);
  invariant(
    metric.matureMushroomColonies <=
      layout.placementRules.maximumMatureMushroomColoniesPerPatch,
    `Patch repeats a full mushroom colony: ${metric.id}`
  );
  invariant(
    metric.nearestNeighbourCv >= 0.3,
    `Patch placement became too even: ${metric.id} (${metric.nearestNeighbourCv})`
  );
  invariant(
    metric.nearestTreeDistanceMetres <=
      layout.placementRules.maximumTreeAnchorDistanceMetres,
    `Patch lost its tree anchor: ${metric.id}`
  );
  invariant(
    metric.minimumPathCoreClearanceMetres >=
      layout.placementRules.pathCoreBufferMetres,
    `Plants entered the path core in ${metric.id}`
  );
}

const reviewViewIds = [
  "hero",
  "reverse",
  "ecology-edge",
  "ecology-hollow",
  "ecology-root",
  "pathwalk",
];
for (const viewId of reviewViewIds) {
  const metadata = await sharp(
    resolve(evidenceDirectory, `forest_environment_qa_${viewId}.png`)
  ).metadata();
  invariant(
    metadata.width === 1280 && metadata.height === 720,
    `Unexpected ${viewId} render size: ${metadata.width}x${metadata.height}`
  );
}
const board = await sharp(boardPath).metadata();
invariant(
  board.width === 2832 && board.height === 1492,
  `Unexpected Gate 7 board size: ${board.width}x${board.height}`
);

console.log(
  JSON.stringify(
    {
      layoutVersion: layout.version,
      layoutSha256,
      ecologyVersion: ecology.version,
      ecologySha256,
      patches: layout.patches.length,
      habitatPatchCounts: Object.fromEntries(
        habitatIds.map((habitatId) => [
          habitatId,
          layout.patches.filter((patch) => patch.habitatId === habitatId)
            .length,
        ])
      ),
      plants: metrics.plantInstanceCount,
      families: metrics.familyCounts,
      variants: metrics.variantCounts,
      modules: metrics.moduleCounts,
      minimumClearingClearanceMetres: metrics.minimumClearingClearanceMetres,
      minimumPathCoreClearanceMetres: metrics.minimumPathCoreClearanceMetres,
      maximumTreeAnchorDistanceMetres: metrics.maximumTreeAnchorDistanceMetres,
      fullRootIslandInstances: metrics.fullRootIslandInstances,
      board: { path: boardPath, width: board.width, height: board.height },
    },
    null,
    2
  )
);
