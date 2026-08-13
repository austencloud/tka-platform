#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const args = process.argv.slice(2);
const manifestIndex = args.indexOf("--manifest");
const manifestPath = resolve(
  manifestIndex >= 0
    ? args[manifestIndex + 1]
    : "scripts/forest-tree-lineup.json"
);
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const evidenceDirectory = manifest.evidenceDirectory
  ? resolve(manifest.evidenceDirectory)
  : resolve(tmpdir(), "tka-forest-evidence", "tree-lineup");
const metricsPath = resolve(
  evidenceDirectory,
  "forest_tree_lineup_metrics.json"
);
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex");
const reviewFrameHeightMetres =
  manifest.reviewFrameHeightMetres ?? manifest.targetHeightMetres;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

invariant(manifest.version === 1, `Expected lineup version 1, found ${manifest.version}`);
invariant(manifest.candidates.length > 0, "Tree lineup has no candidates");

const ids = manifest.candidates.map((candidate) => candidate.id);
invariant(new Set(ids).size === ids.length, "Candidate IDs must be unique");
invariant(metrics.contractVersion === manifest.version, "Metrics contract version is stale");
invariant(metrics.contractSha256 === manifestSha256, "Metrics contract hash is stale");
invariant(
  (metrics.reviewFrameHeightMetres ?? metrics.targetHeightMetres) ===
    reviewFrameHeightMetres,
  "Metrics review frame is stale"
);
invariant(
  metrics.candidates.length === manifest.candidates.length,
  "Metrics candidate count is stale"
);

const allRoles = new Set(manifest.candidates.flatMap((candidate) => candidate.roles));
const requiredRoles = manifest.requiredRoles ?? [
  "mature-canopy",
  "irregular-middle",
  "young",
  "distant-silhouette",
];
for (const role of requiredRoles) {
  invariant(allRoles.has(role), `Lineup is missing the ${role} role`);
}

const renderSize = manifest.renderResolution ?? 840;
for (const candidate of manifest.candidates) {
  const metric = metrics.candidates.find((entry) => entry.id === candidate.id);
  invariant(metric, `Metrics missing for ${candidate.id}`);
  invariant(
    Math.abs(
      metric.reviewHeightMetres -
        (candidate.targetHeightMetres ?? manifest.targetHeightMetres)
    ) < 0.001,
    `${candidate.id} is not at its authored review height`
  );
  invariant(metric.triangles > 0, `${candidate.id} has no triangles`);
  invariant(metric.sourceBytes > 0, `${candidate.id} has no measured source bytes`);
  invariant(metric.materials >= 2, `${candidate.id} has fewer than two semantic surfaces`);
  invariant(
    (metric.materialNames ?? []).some((name) =>
      /trunk|bark|main|branches|island_tree/i.test(name)
    ),
    `${candidate.id} is missing a named woody surface`
  );

  if (candidate.source.runtimePath) {
    invariant(metric.runtimeBytes > 0, `${candidate.id} runtime candidate is missing`);
  }

  for (const view of ["front", "three-quarter", "silhouette"]) {
    const renderPath = metric.renders?.[view];
    invariant(renderPath && existsSync(renderPath), `${candidate.id} ${view} render is missing`);
    const metadata = await sharp(renderPath).metadata();
    invariant(
      metadata.width === renderSize && metadata.height === renderSize,
      `${candidate.id} ${view} render is not ${renderSize}×${renderSize}`
    );
  }
}

const sheetContracts = manifest.contactSheets ?? [];
const sheets = {};
for (const sheet of sheetContracts) {
  const sheetPath = resolve(evidenceDirectory, sheet.output);
  invariant(existsSync(sheetPath), `Contact sheet ${sheet.id} is missing`);
  const metadata = await sharp(sheetPath).metadata();
  const candidateCount = sheet.candidateIds?.length ?? manifest.candidates.length;
  const columns = sheet.columns ?? 1;
  const rows = Math.ceil(candidateCount / columns);
  const expectedWidth = 1000 * columns + 48 * (columns + 1);
  const expectedHeight = 116 + 440 * rows + 34 * rows + 48;
  invariant(
    metadata.width === expectedWidth && metadata.height === expectedHeight,
    `${sheet.id} dimensions changed: ${metadata.width}×${metadata.height}`
  );
  sheets[sheet.id] = `${metadata.width}×${metadata.height}`;
}

const summary = {
  manifestSha256,
  reviewFrameHeightMetres,
  candidates: manifest.candidates.length,
  families: Object.fromEntries(
    Object.entries(Object.groupBy(manifest.candidates, (candidate) => candidate.family)).map(
      ([family, entries]) => [family, entries.length]
    )
  ),
  roleCoverage: [...allRoles].sort(),
  triangles: Object.fromEntries(
    metrics.candidates.map((candidate) => [candidate.id, candidate.triangles])
  ),
  sheets,
};

console.log(JSON.stringify(summary, null, 2));
