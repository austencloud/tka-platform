#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import sharp from "sharp";

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-prop-lineup.json"), "utf8")
);
const evidenceDirectory = resolve(
  tmpdir(),
  "tka-forest-evidence",
  "forest-gate8"
);
const metrics = JSON.parse(
  await readFile(resolve(evidenceDirectory, "forest_gate8_metrics.json"), "utf8")
);
const board = resolve(evidenceDirectory, "forest_gate8_review_board.png");

assert.equal(metrics.manifestVersion, manifest.version);
assert.equal(metrics.framingCandidateCount, manifest.framingCandidates.length);
assert.equal(metrics.framingCandidateCount, 2);
assert.equal(metrics.legacyCandidateCount, 4);
assert.equal(metrics.recommendedCandidateCount, 7);
assert.equal(metrics.paidMeshyCredits, 0);
assert.equal(metrics.creditReserve, 800);
assert.equal(metrics.productionFilesChanged, false);

for (const candidate of metrics.framingCandidates) {
  assert.ok(candidate.clearingMarginMetres >= 0.5, `${candidate.id} clearing margin`);
  assert.ok(candidate.pathMarginMetres >= 2.9, `${candidate.id} path margin`);
  assert.ok(candidate.treeSpacingMarginMetres >= 10, `${candidate.id} tree spacing`);
}

for (const image of Object.values(metrics.outputs)) {
  await access(image);
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, 1600, `${image} width`);
  assert.equal(metadata.height, 900, `${image} height`);
  assert.ok((await stat(image)).size > 500_000, `${image} evidence size`);
}

await access(board);
const boardMetadata = await sharp(board).metadata();
assert.equal(boardMetadata.width, 2864);
assert.equal(boardMetadata.height, 1830);
assert.ok((await stat(board)).size > 1_000_000, "review board evidence size");

console.log(
  JSON.stringify(
    {
      status: "passed",
      manifestVersion: manifest.version,
      framingCandidates: metrics.framingCandidateCount,
      legacyCandidates: metrics.legacyCandidateCount,
      recommendedCandidates: metrics.recommendedCandidateCount,
      paidMeshyCredits: metrics.paidMeshyCredits,
      creditReserve: metrics.creditReserve,
      board,
      boardSize: [boardMetadata.width, boardMetadata.height],
    },
    null,
    2
  )
);
