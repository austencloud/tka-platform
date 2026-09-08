/**
 * Build the committed render-parity corpus fixture from the frozen
 * data-parity snapshot.
 *
 * The rendering wave gate (tests/render-parity/) must run OFFLINE and
 * DETERMINISTICALLY — no Firestore, no PublicSequencesLoader. So it renders a
 * committed fixture: a stride-sample of the real frozen corpus (letter/type/
 * grid diversity) plus BOTH synthetic risk-fixture records (__RISKFX_COMP /
 * __RISKFX_INLINE — they carry handPath/skew/float/pathShape, the exact
 * fields the corpus otherwise lacks; see scripts/migrations/lib/risk-fixtures.ts).
 *
 * Source: scripts/migrations/fixtures/data-parity-baseline.json (produced by
 *   TKA_ADMIN=1 npx tsx scripts/migrations/data-parity-guard.ts --capture)
 * Output: tests/render-parity/fixtures/render-parity-corpus.json (COMMITTED)
 *
 *   npx tsx scripts/migrations/build-render-parity-corpus.ts [--count 24]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(__dirname, "fixtures", "data-parity-baseline.json");
const OUTPUT = join(
  __dirname,
  "..",
  "..",
  "tests",
  "render-parity",
  "fixtures",
  "render-parity-corpus.json"
);

const argv = process.argv.slice(2);
const COUNT = (() => {
  const i = argv.indexOf("--count");
  return i >= 0 && argv[i + 1] ? parseInt(argv[i + 1]!, 10) : 24;
})();

if (!existsSync(SNAPSHOT)) {
  console.error(
    `No snapshot at ${SNAPSHOT}. Run data-parity-guard.ts --capture first.`
  );
  process.exit(1);
}

const { capturedAt, records } = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as {
  capturedAt: string;
  records: Array<{ raw: SequenceData }>;
};

const isRisk = (r: { raw: SequenceData }) =>
  (r.raw.word ?? "").includes("__RISKFX_");
const real = records.filter((r) => !isRisk(r));
const risk = records.filter(isRisk);

// Deterministic stride sample across the whole real corpus.
const take = Math.min(COUNT, real.length);
const stride = take > 0 ? real.length / take : 1;
const picked = Array.from(
  { length: take },
  (_, i) => real[Math.min(Math.floor(i * stride), real.length - 1)]!
);

const sequences = [...picked.map((r) => r.raw), ...risk.map((r) => r.raw)];

// Stats: prove the corpus is non-vacuous on the channels the gate guards.
let steps = 0;
let reversalSteps = 0;
let hydrateFailures = 0;
for (const raw of sequences) {
  try {
    const h = hydrate(raw) as SequenceData;
    steps += h.steps?.length ?? 0;
    for (const s of h.steps ?? []) {
      if (s.leftReversal || s.rightReversal) reversalSteps++;
    }
  } catch {
    hydrateFailures++;
  }
}

if (!existsSync(dirname(OUTPUT)))
  mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      source: "scripts/migrations/fixtures/data-parity-baseline.json",
      sourceCapturedAt: capturedAt,
      count: sequences.length,
      sequences,
    },
    null,
    1
  )
);

console.log(`render-parity corpus -> ${OUTPUT}`);
console.log(
  `  sequences: ${sequences.length} (${picked.length} sampled + ${risk.length} risk fixtures)`
);
console.log(
  `  hydrated steps: ${steps} · reversal-bearing steps: ${reversalSteps} · hydrate failures: ${hydrateFailures}`
);
if (reversalSteps === 0) {
  console.error(
    "  WARNING: zero reversal-bearing steps — the reversal-dot channel would be vacuous."
  );
  process.exit(1);
}
