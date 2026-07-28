/**
 * Merge completed generator-conformance shards into one compressed JSONL
 * dataset and one aggregate summary.
 *
 * Usage:
 *   pnpm exec tsx scripts/merge-generator-conformance.ts \
 *     --root=.claude-artifacts/generator-conformance/current-full-sharded
 */

import {
  createReadStream,
  createWriteStream,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { finished } from "node:stream/promises";
import { once } from "node:events";
import { createHash } from "node:crypto";
import path from "node:path";
import { createGunzip, createGzip } from "node:zlib";

interface ShardSummary {
  profile: string;
  seed: number;
  shard: {
    index: number;
    count: number;
    totalEnumerated: number;
  };
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  attempted: number;
  passed: number;
  expectedRejections?: number;
  generationErrors: number;
  invariantFailures: number;
  phaseCounts: Record<string, number>;
  violationCounts: Record<string, number>;
  errorCounts: Record<string, number>;
  sourceFingerprint: {
    before: string;
    after: string;
    stable: boolean;
  };
  datasetPath: string;
  failureSamplesPath: string;
}

interface CombinedSummary {
  profile: string;
  seed: number;
  shardCount: number;
  totalEnumerated: number;
  complete: boolean;
  startedAt: string;
  finishedAt: string;
  summedWorkerDurationMs: number;
  attempted: number;
  passed: number;
  expectedRejections: number;
  generationErrors: number;
  invariantFailures: number;
  phaseCounts: Record<string, number>;
  violationCounts: Record<string, number>;
  errorCounts: Record<string, number>;
  sourceFingerprint: string;
  datasetSha256: string;
  datasetRecordCount: number;
  datasetPath: string;
  failureSamplesPath: string;
  shardSummaryPaths: string[];
}

const args = process.argv.slice(2);
const inputRoot = path.resolve(readArg("root"));
const outputRoot = path.resolve(
  readArg("out", path.join(inputRoot, "combined"))
);

function readArg(name: string, fallback?: string): string {
  const prefix = `--${name}=`;
  const value = args
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required --${name}=... argument`);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function addCounts(
  target: Map<string, number>,
  source: Record<string, number>
): void {
  for (const [key, count] of Object.entries(source)) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
}

function sortedCounts(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
  );
}

async function appendDataset(
  datasetPath: string,
  output: ReturnType<typeof createGzip>,
  hash: ReturnType<typeof createHash>
): Promise<number> {
  const gunzip = createGunzip();
  createReadStream(datasetPath).pipe(gunzip);
  let recordCount = 0;

  for await (const chunk of gunzip) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(bytes);
    for (const byte of bytes) {
      if (byte === 10) recordCount++;
    }
    if (!output.write(bytes)) {
      await once(output, "drain");
    }
  }

  return recordCount;
}

async function main(): Promise<void> {
  const shardDirectories = readdirSync(inputRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^shard-\d+$/.test(entry.name))
    .map((entry) => path.join(inputRoot, entry.name));

  const shards = shardDirectories
    .map((directory) => {
      const summaryPath = path.join(directory, "summary.json");
      return {
        directory,
        summaryPath,
        summary: readJson<ShardSummary>(summaryPath),
      };
    })
    .sort(
      (left, right) => left.summary.shard.index - right.summary.shard.index
    );

  if (shards.length === 0) {
    throw new Error(`No completed shard summaries found under ${inputRoot}`);
  }

  const first = shards[0]!.summary;
  const expectedIndices = Array.from(
    { length: first.shard.count },
    (_, index) => index
  );
  const actualIndices = shards.map(({ summary }) => summary.shard.index);
  if (JSON.stringify(expectedIndices) !== JSON.stringify(actualIndices)) {
    throw new Error(
      `Expected shard indices [${expectedIndices}], received [${actualIndices}]`
    );
  }

  for (const { summary, summaryPath } of shards) {
    if (
      summary.profile !== first.profile ||
      summary.seed !== first.seed ||
      summary.shard.count !== first.shard.count ||
      summary.shard.totalEnumerated !== first.shard.totalEnumerated
    ) {
      throw new Error(`Shard metadata mismatch in ${summaryPath}`);
    }
    if (
      !summary.sourceFingerprint.stable ||
      summary.sourceFingerprint.before !== first.sourceFingerprint.before
    ) {
      throw new Error(`Source fingerprint mismatch in ${summaryPath}`);
    }
  }

  mkdirSync(outputRoot, { recursive: true });
  const datasetPath = path.join(outputRoot, "cases.jsonl.gz");
  const failureSamplesPath = path.join(outputRoot, "failure-samples.json");
  const summaryPath = path.join(outputRoot, "summary.json");
  const gzip = createGzip({ level: 9 });
  const datasetFile = createWriteStream(datasetPath);
  gzip.pipe(datasetFile);
  const datasetHash = createHash("sha256");
  let datasetRecordCount = 0;

  for (const { summary } of shards) {
    datasetRecordCount += await appendDataset(
      summary.datasetPath,
      gzip,
      datasetHash
    );
  }

  gzip.end();
  await finished(gzip);
  await finished(datasetFile);

  const phaseCounts = new Map<string, number>();
  const violationCounts = new Map<string, number>();
  const errorCounts = new Map<string, number>();
  const failureSamples: Record<string, unknown> = {};
  for (const { summary } of shards) {
    addCounts(phaseCounts, summary.phaseCounts);
    addCounts(violationCounts, summary.violationCounts);
    addCounts(errorCounts, summary.errorCounts);
    const samples = readJson<Record<string, unknown>>(
      summary.failureSamplesPath
    );
    for (const [key, sample] of Object.entries(samples)) {
      failureSamples[key] ??= sample;
    }
  }

  const attempted = shards.reduce(
    (total, { summary }) => total + summary.attempted,
    0
  );
  if (datasetRecordCount !== attempted) {
    throw new Error(
      `Dataset contains ${datasetRecordCount} records, but shard summaries report ${attempted}`
    );
  }

  const summary: CombinedSummary = {
    profile: first.profile,
    seed: first.seed,
    shardCount: first.shard.count,
    totalEnumerated: first.shard.totalEnumerated,
    complete:
      shards.length === first.shard.count &&
      attempted === first.shard.totalEnumerated,
    startedAt: new Date(
      Math.min(
        ...shards.map(({ summary: item }) => new Date(item.startedAt).getTime())
      )
    ).toISOString(),
    finishedAt: new Date(
      Math.max(
        ...shards.map(({ summary: item }) =>
          new Date(item.finishedAt).getTime()
        )
      )
    ).toISOString(),
    summedWorkerDurationMs: shards.reduce(
      (total, { summary: item }) => total + item.durationMs,
      0
    ),
    attempted,
    passed: shards.reduce((total, { summary }) => total + summary.passed, 0),
    expectedRejections: shards.reduce(
      (total, { summary }) => total + (summary.expectedRejections ?? 0),
      0
    ),
    generationErrors: shards.reduce(
      (total, { summary }) => total + summary.generationErrors,
      0
    ),
    invariantFailures: shards.reduce(
      (total, { summary }) => total + summary.invariantFailures,
      0
    ),
    phaseCounts: sortedCounts(phaseCounts),
    violationCounts: sortedCounts(violationCounts),
    errorCounts: sortedCounts(errorCounts),
    sourceFingerprint: first.sourceFingerprint.before,
    datasetSha256: datasetHash.digest("hex"),
    datasetRecordCount,
    datasetPath,
    failureSamplesPath,
    shardSummaryPaths: shards.map(({ summaryPath: item }) => item),
  };

  writeFileSync(
    failureSamplesPath,
    `${JSON.stringify(failureSamples, null, 2)}\n`,
    "utf8"
  );
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.complete) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
