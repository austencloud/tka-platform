/**
 * Parity runner.
 *
 * Re-runs the engine over each captured corpus entry and diffs bit-for-bit
 * against the pinned baseline JSON. Exits non-zero on any divergence with
 * a per-sequence report pinpointing which entry and (when possible) which
 * step diverged.
 *
 * Status: scaffolding. Same reasoning as capture-corpus.ts — the engine
 * adapter lands with Phase 1 prep. CLI interface is stable so downstream
 * CI configs and the sibling parity.test.ts can depend on it.
 *
 * Usage:
 *   tsx tests/parity/run-parity.ts --help
 *   tsx tests/parity/run-parity.ts
 *   tsx tests/parity/run-parity.ts --corpus=tests/parity/corpus --filter=period4
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export interface RunOptions {
  corpusDir: string;
  filter: string | null;
  failFast: boolean;
}

const DEFAULTS: RunOptions = Object.freeze({
  corpusDir: resolve(HERE, "corpus"),
  filter: null,
  failFast: false,
});

const USAGE = `\
run-parity — re-run the engine over the captured corpus and diff outputs

Usage:
  tsx tests/parity/run-parity.ts [options]

Options:
  --corpus=<dir>   Corpus directory produced by capture-corpus.ts
                   (default: tests/parity/corpus)
  --filter=<glob>  Substring match on sequence id; only entries matching
                   are re-run. Useful for triage.
  --fail-fast      Stop on first divergence (default: report all, exit 1)
  -h, --help       Show this message

Exit codes:
  0 on zero divergences across every corpus entry
  1 on at least one divergence (report printed to stderr)
  2 on CLI argument error or missing corpus
`;

export interface Divergence {
  sequenceId: string;
  /** null when outputs differ in length or structure */
  stepIndex: number | null;
  expected: unknown;
  actual: unknown;
  reason: string;
}

function parseArgs(argv: ReadonlyArray<string>): RunOptions | null {
  if (argv.includes("-h") || argv.includes("--help")) return null;
  const opts: {
    corpusDir: string;
    filter: string | null;
    failFast: boolean;
  } = {
    corpusDir: DEFAULTS.corpusDir,
    filter: DEFAULTS.filter,
    failFast: DEFAULTS.failFast,
  };
  for (const arg of argv) {
    if (arg === "--fail-fast") {
      opts.failFast = true;
    } else if (arg.startsWith("--corpus=")) {
      opts.corpusDir = resolve(process.cwd(), arg.slice("--corpus=".length));
    } else if (arg.startsWith("--filter=")) {
      opts.filter = arg.slice("--filter=".length);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return opts;
}

interface CorpusEntry {
  id: string;
  baselinePath: string;
  metaPath: string;
}

async function enumerateCorpus(
  corpusDir: string,
  filter: string | null
): Promise<CorpusEntry[]> {
  if (!existsSync(corpusDir)) {
    throw new Error(
      `Corpus directory not found: ${corpusDir}\n` +
        `Run: tsx tests/parity/capture-corpus.ts first.`
    );
  }
  const names = await readdir(corpusDir);
  const entries: CorpusEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".meta.json")) continue;
    const id = name.slice(0, -".meta.json".length);
    if (filter && !id.includes(filter)) continue;
    entries.push({
      id,
      baselinePath: resolve(corpusDir, `${id}.json`),
      metaPath: resolve(corpusDir, `${id}.meta.json`),
    });
  }
  return entries;
}

async function runEngine(meta: Record<string, unknown>): Promise<string> {
  void meta;
  throw new Error(
    "Engine adapter not wired yet — lands with Phase 1 prep. " +
      "Until then, run-parity enumerates corpus entries but cannot diff."
  );
}

export async function runParity(
  opts: RunOptions = { ...DEFAULTS }
): Promise<Divergence[]> {
  const entries = await enumerateCorpus(opts.corpusDir, opts.filter);
  const divergences: Divergence[] = [];
  if (entries.length === 0) {
    console.warn(
      `[parity] no corpus entries found in ${opts.corpusDir}; nothing to diff.`
    );
    return divergences;
  }
  console.log(`[parity] ${entries.length} entries queued`);
  for (const entry of entries) {
    const meta = JSON.parse(await readFile(entry.metaPath, "utf8"));
    let expected: string;
    if (existsSync(entry.baselinePath)) {
      expected = await readFile(entry.baselinePath, "utf8");
    } else {
      divergences.push({
        sequenceId: entry.id,
        stepIndex: null,
        expected: "<no baseline>",
        actual: null,
        reason: "baseline file missing — run capture-corpus.ts to populate",
      });
      if (opts.failFast) break;
      continue;
    }
    let actual: string;
    try {
      actual = await runEngine(meta);
    } catch (err) {
      divergences.push({
        sequenceId: entry.id,
        stepIndex: null,
        expected,
        actual: null,
        reason: `engine run failed: ${(err as Error).message}`,
      });
      if (opts.failFast) break;
      continue;
    }
    if (actual !== expected) {
      divergences.push({
        sequenceId: entry.id,
        stepIndex: null,
        expected,
        actual,
        reason: "canonical output differs from baseline",
      });
      if (opts.failFast) break;
    }
  }
  return divergences;
}

function printDivergences(divergences: ReadonlyArray<Divergence>): void {
  for (const d of divergences) {
    process.stderr.write(`\n--- DIVERGENCE: ${d.sequenceId} ---\n`);
    process.stderr.write(`reason: ${d.reason}\n`);
    if (d.stepIndex !== null) {
      process.stderr.write(`stepIndex: ${d.stepIndex}\n`);
    }
  }
}

export async function main(argv: ReadonlyArray<string>): Promise<number> {
  let opts: RunOptions | null;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n\n`);
    process.stderr.write(USAGE);
    return 2;
  }
  if (opts === null) {
    process.stdout.write(USAGE);
    return 0;
  }
  try {
    const divergences = await runParity(opts);
    if (divergences.length === 0) {
      console.log("[parity] 0 divergences — corpus matches baseline");
      return 0;
    }
    printDivergences(divergences);
    process.stderr.write(`\n[parity] ${divergences.length} divergence(s) found\n`);
    return 1;
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return 2;
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const entryUrl = new URL(`file:///${entry.replace(/\\/g, "/")}`).href;
  const selfUrl = new URL(import.meta.url).href;
  return entryUrl.toLowerCase() === selfUrl.toLowerCase();
}

if (isMainModule()) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}
