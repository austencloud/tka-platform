/**
 * Smoke test (read-only): prove a real load → save-unchanged at V2 does NOT fork.
 *
 * Pre-flip checklist item #3 of the content-hash V2 rollout. The determinism
 * unit test covers the hash side with synthetic fixtures; this covers the FULL
 * live path against REAL migrated prod docs.
 *
 * For each sampled doc it computes two V2 hashes and compares them to the stored
 * `contentHash`:
 *   - migrationBasis: computeHash(hydrate({ ...rawData, id }))         — what the
 *     migration wrote.
 *   - liveBasis:      computeHash(hydrate(mapDocReplica(rawData, id))) — what a
 *     save-unchanged recomputes on the live read path (saveSequence's
 *     incomingHash comes from a mapDoc→hydrate'd sequence).
 * `mapDocReplica` mirrors LibraryRepository.mapDocToLibrarySequence's
 * hash-relevant funnel (steps ?? sequenceData.steps ?? beats). Metadata it also
 * sets (word/dates/tags) is not part of the identity hash.
 *
 * PASS = for every doc, stored === migrationBasis === liveBasis (fork=false on
 * resave). Any mismatch is a latent fork and prints the doc id.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/smoke-v2-fork-safety.ts
 *   TKA_ADMIN=1 npx tsx scripts/migrations/smoke-v2-fork-safety.ts --limit 80
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import {
  computeHash,
  HASH_VERSION_V2,
} from "../../src/lib/shared/library/services/sequence-content-hasher";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;
const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 && argv[i + 1] ? parseInt(argv[i + 1]!, 10) : 60;
})();

// Mirror the hash-relevant part of LibraryRepository.mapDocToLibrarySequence:
// funnel whichever slot holds the motion array into `steps`. hydrate() then
// re-derives steps from compositional fields, so this only matters for docs
// without compositional data.
function mapDocReplica(data: AnyRec, id: string): SequenceData {
  const seqData = (data["sequenceData"] as AnyRec) || {};
  const steps =
    (data["steps"] as unknown[]) ||
    (seqData["steps"] as unknown[]) ||
    (data["beats"] as unknown[]) ||
    (seqData["beats"] as unknown[]);
  return {
    ...(data as object),
    id,
    ...(steps && steps.length > 0 ? { steps } : {}),
  } as SequenceData;
}

async function sample(
  db: AnyRec,
  label: string,
  path: string,
  limit: number
): Promise<{ checked: number; forks: number }> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  const docs = (snap.docs as Array<{ id: string; data: () => AnyRec }>).slice(0, limit);
  let checked = 0;
  let forks = 0;
  console.log(`\n──────── ${label} (sampling ${docs.length}) ────────`);
  for (const d of docs) {
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    const stored = data["contentHash"] as string | undefined;
    const ver = data["contentHashVersion"];
    if (!stored) continue;

    let migBasis: string;
    let liveBasis: string;
    try {
      const migSeq = hydrate({ ...(data as object), id: d.id } as SequenceData) as SequenceData;
      const liveSeq = hydrate(mapDocReplica(data, d.id)) as SequenceData;
      if (!migSeq.steps?.length || !liveSeq.steps?.length) continue;
      migBasis = await computeHash(migSeq, HASH_VERSION_V2);
      liveBasis = await computeHash(liveSeq, HASH_VERSION_V2);
    } catch {
      continue;
    }
    checked++;

    const forksOnResave = liveBasis !== stored;
    if (forksOnResave || migBasis !== stored) {
      forks++;
      console.log(
        `  ⚠ ${d.id} v=${ver} stored=${stored.slice(0, 12)} mig=${migBasis.slice(0, 12)} live=${liveBasis.slice(0, 12)}`
      );
    }
  }
  console.log(`  checked=${checked} would-fork-on-resave=${forks}`);
  return { checked, forks };
}

async function main(): Promise<void> {
  const { db, sdk } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} — V2 fork-safety smoke — limit ${LIMIT}/collection`);
  let checked = 0;
  let forks = 0;
  for (const [label, path] of [
    ["user library", `users/${DEFAULT_USER}/sequences`],
    ["public mirror", "publicSequences"],
  ] as const) {
    const r = await sample(db, label, path, LIMIT);
    checked += r.checked;
    forks += r.forks;
  }
  console.log(
    `\n═══ TOTAL checked=${checked} would-fork-on-resave=${forks} ${forks === 0 ? "✅ NO FORKS" : "❌ FORK RISK"} ═══`
  );
  process.exit(forks === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
