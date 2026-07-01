/**
 * Step-Constructability Check — the make-or-break diagnostic for StepData->Step.
 *
 * Canonical `Step` requires BOTH motions ({blue: Motion; red: Motion}); the
 * forward bridge `stepDataToStep` throws if either is missing (step-bridge.ts:73).
 * App `StepData.motions` is Partial, so the whole migration premise depends on an
 * empirical fact: does EVERY real production step actually carry both motions?
 *
 * If yes -> canonical Step can represent the corpus; the migration is viable as
 * specced. If no -> one-handed steps exist and the both-required invariant must
 * be reconciled (static-fill blanks, or a representation decision) BEFORE any
 * codemod. This runs before touching a line of product code — zero blast radius.
 *
 * Distinguishes BLANK steps (isBlank, missing motions is expected/benign) from
 * NON-BLANK one-handed steps (the dangerous, premise-breaking case).
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/step-constructability-check.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/step-constructability-check.ts --limit 100 --user <uid>
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import { stepDataToStep } from "../../src/lib/shared/foundation/domain/adapters/step-bridge";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;
const argv = process.argv.slice(2);
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? parseInt(argv[i + 1]!, 10) : Infinity;
})();
const userArg = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : null;
})();

interface Failure {
  word: string;
  stepNumber: number;
  isBlank: boolean;
  reason: string;
}

async function scan(
  db: AnyRec,
  label: string,
  path: string
): Promise<{ seqs: number; steps: number; ok: number; failures: Failure[] }> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  const docs = (snap.docs as Array<{ id: string; data: () => AnyRec }>).slice(
    0,
    Number.isFinite(LIMIT) ? (LIMIT as number) : undefined
  );
  let seqs = 0;
  let steps = 0;
  let ok = 0;
  const failures: Failure[] = [];
  console.log(`\n──────── ${label} (${docs.length} docs) ────────`);
  for (const d of docs) {
    const raw = { ...(d.data() as object), id: d.id } as SequenceData;
    if ((raw as AnyRec)["isDeleted"] === true) continue;
    let hydrated: SequenceData;
    try {
      hydrated = hydrate(raw) as SequenceData;
    } catch {
      continue;
    }
    if (!hydrated.steps || hydrated.steps.length === 0) continue;
    seqs++;
    for (const step of hydrated.steps) {
      steps++;
      try {
        stepDataToStep(step);
        ok++;
      } catch (e) {
        failures.push({
          word: hydrated.word ?? d.id,
          stepNumber: step.stepNumber,
          isBlank: step.isBlank === true,
          reason: (e instanceof Error ? e.message : String(e)).replace(/step \d+ \([^)]+\) /, ""),
        });
      }
    }
  }
  console.log(`  sequences=${seqs} steps=${steps} constructable=${ok} failed=${failures.length}`);
  return { seqs, steps, ok, failures };
}

async function main(): Promise<void> {
  const { db, sdk } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} — Step-constructability over ${Number.isFinite(LIMIT) ? LIMIT : "ALL"} docs/collection`);
  const results = [await scan(db, "public mirror", "publicSequences")];
  if (userArg) results.push(await scan(db, "user library", `users/${userArg}/sequences`));

  const all = results.reduce(
    (a, r) => ({
      seqs: a.seqs + r.seqs,
      steps: a.steps + r.steps,
      ok: a.ok + r.ok,
      failures: [...a.failures, ...r.failures],
    }),
    { seqs: 0, steps: 0, ok: 0, failures: [] as Failure[] }
  );

  const blankFails = all.failures.filter((f) => f.isBlank);
  const realFails = all.failures.filter((f) => !f.isBlank);

  console.log(`\n═══ TOTAL: ${all.seqs} sequences, ${all.steps} steps ═══`);
  console.log(`  constructable (both motions -> canonical Step): ${all.ok} (${((all.ok / all.steps) * 100).toFixed(2)}%)`);
  console.log(`  missing-motion failures: ${all.failures.length}`);
  console.log(`    · blank steps (benign — represent via isBlank/static-fill): ${blankFails.length}`);
  console.log(`    · NON-BLANK one-handed (PREMISE-BREAKING): ${realFails.length}`);

  if (realFails.length > 0) {
    console.log(`\n⚠ NON-BLANK one-handed steps exist — the both-required invariant does NOT hold as-is. First 20:`);
    for (const f of realFails.slice(0, 20)) console.log(`    ${f.word} step ${f.stepNumber}: ${f.reason}`);
    console.log(`\n=> Reconcile one-handed representation BEFORE any StepData->Step codemod.`);
  } else if (blankFails.length > 0) {
    console.log(`\n✅ Every NON-BLANK step is canonical-Step-constructable. Only blank steps lack motions — handle via static-fill or isBlank branch. Migration premise HOLDS for real motion.`);
  } else {
    console.log(`\n✅ EVERY step (including blanks) constructs a canonical Step. Migration premise fully holds.`);
  }
  process.exit(realFails.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
