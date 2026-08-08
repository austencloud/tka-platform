#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const manifestPath = resolve("scripts/forest-tree-lineup.json");
const evidenceDirectory = resolve(
  tmpdir(),
  "tka-forest-evidence",
  "tree-lineup"
);
const metricsPath = resolve(
  evidenceDirectory,
  "forest_tree_lineup_metrics.json"
);
const currentSheet = resolve(
  evidenceDirectory,
  "forest_tree_lineup_current.png"
);
const autumnSheet = resolve(evidenceDirectory, "forest_tree_lineup_autumn.png");
const freshSheet = resolve(evidenceDirectory, "forest_tree_lineup_fresh.png");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");

invariant(
  manifest.version === 1,
  `Expected lineup version 1, found ${manifest.version}`
);
invariant(
  manifest.targetHeightMetres === 12,
  "Tree lineup must use a 12 m review height"
);
invariant(
  manifest.candidates.length === 13,
  `Expected 13 candidates, found ${manifest.candidates.length}`
);

const ids = manifest.candidates.map((candidate) => candidate.id);
invariant(new Set(ids).size === ids.length, "Candidate IDs must be unique");
invariant(
  metrics.contractVersion === manifest.version,
  "Metrics contract version is stale"
);
invariant(
  metrics.contractSha256 === manifestSha256,
  "Metrics contract hash is stale"
);
invariant(
  metrics.targetHeightMetres === manifest.targetHeightMetres,
  "Metrics review height is stale"
);
invariant(
  metrics.candidates.length === manifest.candidates.length,
  "Metrics candidate count is stale"
);

const allRoles = new Set(
  manifest.candidates.flatMap((candidate) => candidate.roles)
);
for (const role of [
  "mature-canopy",
  "irregular-middle",
  "young",
  "snag",
  "distant-silhouette",
]) {
  invariant(allRoles.has(role), `Lineup is missing the ${role} role`);
}

for (const candidate of manifest.candidates) {
  const metric = metrics.candidates.find((entry) => entry.id === candidate.id);
  invariant(metric, `Metrics missing for ${candidate.id}`);
  invariant(
    metric.reviewHeightMetres === 12,
    `${candidate.id} is not normalized to 12 m`
  );
  invariant(metric.triangles > 0, `${candidate.id} has no triangles`);
  invariant(
    metric.sourceBytes > 0,
    `${candidate.id} has no measured source bytes`
  );

  for (const view of ["front", "three-quarter", "silhouette"]) {
    const renderPath = metric.renders?.[view];
    invariant(
      renderPath && existsSync(renderPath),
      `${candidate.id} ${view} render is missing`
    );
    const metadata = await sharp(renderPath).metadata();
    invariant(
      metadata.width === 720 && metadata.height === 720,
      `${candidate.id} ${view} render is not 720×720`
    );
  }
}

const [currentMetadata, autumnMetadata, freshMetadata] = await Promise.all([
  sharp(currentSheet).metadata(),
  sharp(autumnSheet).metadata(),
  sharp(freshSheet).metadata(),
]);
invariant(
  currentMetadata.width === 1096 && currentMetadata.height === 1586,
  "Current tree sheet dimensions changed"
);
invariant(
  autumnMetadata.width === 2144 && autumnMetadata.height === 1586,
  "Autumn tree sheet dimensions changed"
);
invariant(
  freshMetadata.width === 1096 && freshMetadata.height === 2060,
  "Fresh Forest tree sheet dimensions changed"
);

const summary = {
  manifestSha256,
  targetHeightMetres: manifest.targetHeightMetres,
  candidates: manifest.candidates.length,
  families: Object.fromEntries(
    Object.entries(
      Object.groupBy(manifest.candidates, (candidate) => candidate.family)
    ).map(([family, entries]) => [family, entries.length])
  ),
  roleCoverage: [...allRoles].sort(),
  triangles: Object.fromEntries(
    metrics.candidates.map((candidate) => [candidate.id, candidate.triangles])
  ),
  sheets: {
    current: `${currentMetadata.width}×${currentMetadata.height}`,
    autumn: `${autumnMetadata.width}×${autumnMetadata.height}`,
    fresh: `${freshMetadata.width}×${freshMetadata.height}`,
  },
};

console.log(JSON.stringify(summary, null, 2));
