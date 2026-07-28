/**
 * Analyze a generator-conformance JSONL dataset without loading it all into
 * memory. Produces per-axis outcome tables and paired Box/Diamond results.
 *
 * Usage:
 *   pnpm exec tsx scripts/analyze-generator-conformance.ts \
 *     --dataset=.claude-artifacts/generator-conformance/current-full-sharded/combined/cases.jsonl.gz
 */

import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { createGunzip } from "node:zlib";

type Outcome =
  | "pass"
  | "expected-rejection"
  | "generation-error"
  | "invariant-failure";

interface AuditRecord {
  id: string;
  phase: string;
  params: Record<string, unknown>;
  status: Outcome;
  violations: string[];
  error?: string;
}

interface Counts {
  attempted: number;
  passed: number;
  expectedRejections: number;
  generationErrors: number;
  invariantFailures: number;
}

interface ReportRow extends Counts {
  value: string;
  passRate: number;
  conformanceRate: number;
}

interface GridPair {
  box?: Outcome;
  diamond?: Outcome;
}

const args = process.argv.slice(2);
const datasetPath = path.resolve(readArg("dataset"));
const outputPath = path.resolve(
  readArg("out", path.join(path.dirname(datasetPath), "analysis.json"))
);
const AXES = [
  "phase",
  "gridMode",
  "loopType",
  "period",
  "level",
  "constraintPreset",
  "handPathMode",
  "motionTypeFilter",
  "length",
] as const;

function readArg(name: string, fallback?: string): string {
  const prefix = `--${name}=`;
  const value = args
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required --${name}=... argument`);
}

function emptyCounts(): Counts {
  return {
    attempted: 0,
    passed: 0,
    expectedRejections: 0,
    generationErrors: 0,
    invariantFailures: 0,
  };
}

function countOutcome(counts: Counts, outcome: Outcome): void {
  counts.attempted++;
  if (outcome === "pass") counts.passed++;
  if (outcome === "expected-rejection") counts.expectedRejections++;
  if (outcome === "generation-error") counts.generationErrors++;
  if (outcome === "invariant-failure") counts.invariantFailures++;
}

function valueForAxis(
  record: AuditRecord,
  axis: (typeof AXES)[number]
): string {
  if (axis === "phase") return record.phase;
  const value = record.params[axis];
  if (axis === "loopType" && value === undefined) return "(freeform)";
  return value === undefined ? "(unset)" : String(value);
}

function addAxisOutcome(
  axes: Map<string, Map<string, Counts>>,
  axis: string,
  value: string,
  outcome: Outcome
): void {
  let rows = axes.get(axis);
  if (!rows) {
    rows = new Map();
    axes.set(axis, rows);
  }
  let counts = rows.get(value);
  if (!counts) {
    counts = emptyCounts();
    rows.set(value, counts);
  }
  countOutcome(counts, outcome);
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function violationCode(violation: string): string {
  return violation.split(":", 1)[0] ?? violation;
}

function errorSignature(error: string): string {
  return error
    .replace(/\b\d+\b/g, "#")
    .replace(/\s+/g, " ")
    .slice(0, 240);
}

function gridPairKey(record: AuditRecord): string {
  const params = Object.fromEntries(
    Object.entries(record.params).filter(([key]) => key !== "gridMode")
  );
  return JSON.stringify({ phase: record.phase, params });
}

function reportRows(rows: Map<string, Counts>): ReportRow[] {
  return [...rows.entries()]
    .map(([value, counts]) => ({
      value,
      ...counts,
      passRate:
        counts.attempted === 0
          ? 0
          : Number((counts.passed / counts.attempted).toFixed(6)),
      conformanceRate:
        counts.attempted === 0
          ? 0
          : Number(
              (
                (counts.passed + counts.expectedRejections) /
                counts.attempted
              ).toFixed(6)
            ),
    }))
    .sort(
      (left, right) =>
        left.conformanceRate - right.conformanceRate ||
        left.passRate - right.passRate ||
        right.attempted - left.attempted ||
        left.value.localeCompare(right.value)
    );
}

function sortedCountEntries(
  counts: Map<string, number>
): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
  );
}

async function main(): Promise<void> {
  const totals = emptyCounts();
  const axes = new Map<string, Map<string, Counts>>();
  const violations = new Map<string, number>();
  const errors = new Map<string, number>();
  const gridPairs = new Map<string, GridPair>();
  const recordIds = new Set<string>();
  let duplicateRecordIds = 0;
  const input = createReadStream(datasetPath).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as AuditRecord;
    if (recordIds.has(record.id)) {
      duplicateRecordIds++;
    } else {
      recordIds.add(record.id);
    }
    countOutcome(totals, record.status);

    for (const axis of AXES) {
      addAxisOutcome(axes, axis, valueForAxis(record, axis), record.status);
    }

    for (const violation of record.violations) {
      increment(violations, violationCode(violation));
    }
    if (record.error && record.status === "generation-error") {
      increment(errors, errorSignature(record.error));
    }

    const gridMode = record.params.gridMode;
    if (gridMode === "box" || gridMode === "diamond") {
      const key = gridPairKey(record);
      const pair = gridPairs.get(key) ?? {};
      pair[gridMode] = record.status;
      gridPairs.set(key, pair);
    }
  }

  const pairCounts = {
    paired: 0,
    bothPass: 0,
    boxOnlyPass: 0,
    diamondOnlyPass: 0,
    neitherPass: 0,
    unpaired: 0,
  };
  for (const pair of gridPairs.values()) {
    if (!pair.box || !pair.diamond) {
      pairCounts.unpaired++;
      continue;
    }
    pairCounts.paired++;
    if (pair.box === "pass" && pair.diamond === "pass") {
      pairCounts.bothPass++;
    } else if (pair.box === "pass") {
      pairCounts.boxOnlyPass++;
    } else if (pair.diamond === "pass") {
      pairCounts.diamondOnlyPass++;
    } else {
      pairCounts.neitherPass++;
    }
  }

  const report = {
    datasetPath,
    totals: {
      ...totals,
      passRate:
        totals.attempted === 0
          ? 0
          : Number((totals.passed / totals.attempted).toFixed(6)),
      conformanceRate:
        totals.attempted === 0
          ? 0
          : Number(
              (
                (totals.passed + totals.expectedRejections) /
                totals.attempted
              ).toFixed(6)
            ),
    },
    recordIdentity: {
      uniqueRecordIds: recordIds.size,
      duplicateRecordIds,
    },
    byAxis: Object.fromEntries(
      AXES.map((axis) => [axis, reportRows(axes.get(axis) ?? new Map())])
    ),
    boxDiamondPairs: pairCounts,
    violationCounts: sortedCountEntries(violations),
    errorCounts: sortedCountEntries(errors),
  };

  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (duplicateRecordIds > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
