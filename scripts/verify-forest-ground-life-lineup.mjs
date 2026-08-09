#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const manifestPath = resolve("scripts/forest-ground-life-lineup.json");
const evidenceDirectory = resolve(
  tmpdir(),
  "tka-forest-evidence",
  "ground-life-lineup"
);
const metricsPath = resolve(
  evidenceDirectory,
  "forest_ground_life_lineup_metrics.json"
);
const sheetPath = resolve(evidenceDirectory, "forest_ground_life_lineup.png");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");

invariant(
  manifest.version === 1,
  `Unexpected lineup version: ${manifest.version}`
);
invariant(
  manifest.candidates.length === 9,
  `Expected 9 candidates, found ${manifest.candidates.length}`
);
invariant(
  new Set(manifest.candidates.map((candidate) => candidate.id)).size ===
    manifest.candidates.length,
  "Candidate IDs must be unique"
);
invariant(
  metrics.contractVersion === manifest.version,
  "Metrics version is stale"
);
invariant(
  metrics.contractSha256 === manifestSha256,
  "Metrics contract hash is stale"
);
invariant(
  metrics.candidates.length === manifest.candidates.length,
  "Metrics candidate count is stale"
);

const roleCoverage = new Set(
  manifest.candidates.flatMap((candidate) => candidate.roles)
);
for (const role of [
  "shrub",
  "fern",
  "grass",
  "mushroom",
  "root",
  "leaf-litter",
]) {
  invariant(roleCoverage.has(role), `Lineup is missing the ${role} role`);
}

for (const candidate of manifest.candidates) {
  const metric = metrics.candidates.find((entry) => entry.id === candidate.id);
  invariant(metric, `Metrics missing for ${candidate.id}`);
  invariant(
    metric.targetHeightMetres === candidate.targetHeightMetres,
    `${candidate.id} review height is stale`
  );
  invariant(metric.triangles > 0, `${candidate.id} has no triangles`);
  invariant(
    metric.sourceBytes > 0,
    `${candidate.id} has no measured source bytes`
  );
  for (const view of manifest.reviewViews) {
    const renderPath = metric.renders?.[view];
    invariant(
      renderPath && existsSync(renderPath),
      `${candidate.id} ${view} render is missing`
    );
    const metadata = await sharp(renderPath).metadata();
    invariant(
      metadata.width === 640 && metadata.height === 640,
      `${candidate.id} ${view} render is not 640×640`
    );
  }
}

const sheet = await sharp(sheetPath).metadata();
invariant(
  sheet.width === 2296 && sheet.height === 1780,
  `Unexpected sheet dimensions: ${sheet.width}×${sheet.height}`
);

console.log(
  JSON.stringify(
    {
      manifestSha256,
      candidates: manifest.candidates.length,
      families: Object.fromEntries(
        Object.entries(
          Object.groupBy(manifest.candidates, (candidate) => candidate.family)
        ).map(([family, entries]) => [family, entries.length])
      ),
      roleCoverage: [...roleCoverage].sort(),
      triangles: Object.fromEntries(
        metrics.candidates.map((candidate) => [
          candidate.id,
          candidate.triangles,
        ])
      ),
      sheet: `${sheet.width}×${sheet.height}`,
    },
    null,
    2
  )
);
