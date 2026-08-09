#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const contractPath = resolve("scripts/forest-ground-life-ecology.json");
const evidenceDirectory = resolve(
  tmpdir(),
  "tka-forest-evidence",
  "ground-life-ecology"
);
const metricsPath = resolve(
  evidenceDirectory,
  "forest_ground_life_ecology_metrics.json"
);
const sheetPath = resolve(
  evidenceDirectory,
  "forest_ground_life_ecology_board.png"
);

const [contractBytes, metricsBytes] = await Promise.all([
  readFile(contractPath),
  readFile(metricsPath),
]);
const contract = JSON.parse(contractBytes);
const metrics = JSON.parse(metricsBytes);
const rules = contract.reviewRules;
const contractSha256 = createHash("sha256").update(contractBytes).digest("hex");

invariant(
  metrics.contractVersion === contract.version,
  "Ecology metrics use the wrong contract version"
);
invariant(
  metrics.contractSha256 === contractSha256,
  "Ecology metrics are stale for the current contract"
);
invariant(
  contract.habitats.length >= rules.minimumHabitats,
  `Ecology board needs at least ${rules.minimumHabitats} habitats`
);
invariant(
  metrics.habitats.length === contract.habitats.length,
  "Ecology metrics do not cover every habitat"
);
invariant(
  metrics.sources.length === contract.sources.length,
  "Ecology metrics do not cover every source asset"
);

const expectedVariants = new Set(
  contract.families.flatMap((family) =>
    family.variants.map((variant) => `${family.id}-${variant}`)
  )
);
const actualVariants = new Set(metrics.distinctPlantVariants);
for (const variant of expectedVariants) {
  invariant(
    actualVariants.has(variant),
    `Ecology board never shows ${variant}`
  );
}
invariant(
  actualVariants.size >= rules.minimumDistinctPlantVariants,
  `Ecology board needs at least ${rules.minimumDistinctPlantVariants} plant variants`
);

const expectedModules = new Set(contract.groundModules);
const actualModules = new Set(metrics.groundModuleTypes);
for (const module of expectedModules) {
  invariant(actualModules.has(module), `Ecology board never shows ${module}`);
}
invariant(
  actualModules.size >= rules.minimumGroundModuleTypes,
  `Ecology board needs at least ${rules.minimumGroundModuleTypes} ground module types`
);
invariant(
  metrics.fullRootIslandInstances <= rules.maximumFullRootIslandInstances,
  "The circular full root island returned to the ecology board"
);

const habitatSummaries = [];
for (const habitat of contract.habitats) {
  const metric = metrics.habitats.find((entry) => entry.id === habitat.id);
  invariant(metric, `Missing ecology metric for ${habitat.id}`);
  invariant(
    metric.premise === habitat.premise,
    `${habitat.id} lost its ecological premise`
  );
  invariant(
    metric.placementGrammar === habitat.placementGrammar,
    `${habitat.id} lost its placement grammar`
  );
  invariant(
    metric.negativeSpaceFraction === habitat.negativeSpaceFraction,
    `${habitat.id} lost its negative-space target`
  );
  invariant(
    metric.negativeSpaceFraction >= 0.25 && metric.negativeSpaceFraction <= 0.6,
    `${habitat.id} has an implausible negative-space target`
  );
  invariant(
    metric.triangles > 0,
    `${habitat.id} contains no renderable geometry`
  );
  invariant(
    metric.fullRootIslandInstances <= rules.maximumFullRootIslandInstances,
    `${habitat.id} uses the rejected full root island`
  );
  for (const [variant, count] of Object.entries(metric.variantCounts)) {
    invariant(
      count <= rules.maximumRepeatedFullMeshPerHabitat,
      `${habitat.id} repeats ${variant} ${count} times`
    );
  }
  for (const family of habitat.dominantFamilies) {
    invariant(
      Object.keys(metric.variantCounts).some((variant) =>
        variant.startsWith(`${family}-`)
      ),
      `${habitat.id} does not show dominant family ${family}`
    );
  }
  invariant(existsSync(metric.render), `${habitat.id} render is missing`);
  const image = await sharp(metric.render).metadata();
  invariant(
    image.width === 960 && image.height === 640,
    `${habitat.id} render must be 960 x 640`
  );
  habitatSummaries.push({
    id: habitat.id,
    variants: Object.keys(metric.variantCounts),
    negativeSpaceFraction: metric.negativeSpaceFraction,
    leafCount: metric.leafCount,
    groundModules: metric.groundModules,
    triangles: metric.triangles,
  });
}

invariant(existsSync(sheetPath), "Ecology contact sheet is missing");
const sheet = await sharp(sheetPath).metadata();
invariant(
  sheet.width === 2832 && sheet.height === 1570,
  `Unexpected ecology sheet size ${sheet.width} x ${sheet.height}`
);

console.log(
  JSON.stringify(
    {
      contractSha256,
      habitats: habitatSummaries,
      distinctPlantVariants: [...actualVariants].sort(),
      groundModuleTypes: [...actualModules].sort(),
      fullRootIslandInstances: metrics.fullRootIslandInstances,
      sheet: `${sheet.width}×${sheet.height}`,
    },
    null,
    2
  )
);
