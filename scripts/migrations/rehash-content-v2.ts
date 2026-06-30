/**
 * Re-hash every sequence's `contentHash` under identity-hash V2.
 *
 * V2 excludes the round-trip-derived fields (blueReversal, redReversal,
 * gridMode) so identity is invariant under hydrate re-derivation — killing the
 * phantom-fork-on-resave. Background + proof:
 *   docs/superpowers/specs/active/2026-06-30-reversal-derivation-reconciliation-findings.md
 *   docs/superpowers/specs/active/2026-06-30-content-hash-v2-rollout.md
 *   tests/unit/content-hash-v2-fork-proof.test.ts
 *
 * Writes `contentHash` (recomputed under V2) + `contentHashVersion: 2` on every
 * non-deleted doc. Idempotent: a doc already at V2 with a matching hash is
 * skipped.
 *
 * ⚠ ROLLOUT ORDER — do NOT run standalone. This is step 2 of 3:
 *   1. Deploy the app with VERSION-AWARE fork detection (compares same-version
 *      hashes; lazy-rehashes on version mismatch instead of forking). Active
 *      CONTENT_HASH_VERSION stays V1 at this point.
 *   2. Run this migration (--apply) to eagerly rewrite all stored hashes to V2.
 *   3. Flip CONTENT_HASH_VERSION to V2 and deploy.
 * Running this before step 1 mismatches a V1 app against V2 hashes → mass-fork.
 * See the rollout spec for the full ordering + the lazy-rehash backstop.
 *
 *   npx tsx scripts/migrations/rehash-content-v2.ts             # dry-run
 *   npx tsx scripts/migrations/rehash-content-v2.ts --apply
 *   npx tsx scripts/migrations/rehash-content-v2.ts --user <uid> --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import {
  computeHash,
  HASH_VERSION_V2,
} from "../../src/lib/shared/library/services/sequence-content-hasher";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

// computeHash uses crypto.subtle — guard for older Node runtimes.
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;
const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const userId = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_USER;
})();

async function processCollection(
  db: AnyRec,
  label: string,
  path: string
): Promise<{ scanned: number; rewritten: number; unchanged: number; failed: number }> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let scanned = 0,
    rewritten = 0,
    unchanged = 0,
    failed = 0;
  console.log(`\n──────── ${label} (${path}) ────────`);
  for (const d of snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>) {
    scanned++;
    const data = d.data();
    if (data["isDeleted"] === true) continue;

    let hydrated: SequenceData;
    try {
      hydrated = hydrate({ ...(data as object), id: d.id } as SequenceData) as SequenceData;
    } catch {
      continue;
    }
    if (!hydrated.steps || hydrated.steps.length === 0) continue;

    let newHash: string;
    try {
      newHash = await computeHash(hydrated, HASH_VERSION_V2);
    } catch {
      failed++;
      continue;
    }

    const alreadyV2 = data["contentHashVersion"] === HASH_VERSION_V2;
    if (alreadyV2 && data["contentHash"] === newHash) {
      unchanged++;
      continue;
    }

    if (APPLY) {
      try {
        await (d.ref as AnyRec)["update"]({
          contentHash: newHash,
          contentHashVersion: HASH_VERSION_V2,
        });
      } catch (e) {
        failed++;
        if (!String(e).includes("PERMISSION_DENIED"))
          console.log(`  ❌ ${d.id} ${e instanceof Error ? e.message : e}`);
        continue;
      }
    }
    rewritten++;
  }
  console.log(
    `  scanned=${scanned} ${APPLY ? "" : "would: "}rewritten=${rewritten} unchanged=${unchanged} failed=${failed}`
  );
  return { scanned, rewritten, unchanged, failed };
}

async function main(): Promise<void> {
  const { db, sdk } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"} — target identity-hash V2`);
  const totals = { scanned: 0, rewritten: 0, unchanged: 0, failed: 0 };
  const add = (r: { scanned: number; rewritten: number; unchanged: number; failed: number }) => {
    totals.scanned += r.scanned;
    totals.rewritten += r.rewritten;
    totals.unchanged += r.unchanged;
    totals.failed += r.failed;
  };
  add(await processCollection(db, "user library", `users/${userId}/sequences`));
  add(await processCollection(db, "public mirror", "publicSequences"));
  // System catalogs (deck variants) live under systemCatalogs/{id}/sequences;
  // enumerate the catalogs, then rehash each catalog's sequences.
  try {
    const catSnap = await (db.collection as (p: string) => AnyRec)("systemCatalogs")["get"]();
    for (const c of catSnap.docs as Array<{ id: string }>) {
      add(await processCollection(db, `catalog ${c.id}`, `systemCatalogs/${c.id}/sequences`));
    }
  } catch (e) {
    console.log(`  (systemCatalogs skipped: ${e instanceof Error ? e.message : e})`);
  }

  console.log(
    `\n═══ TOTAL: scanned=${totals.scanned} ${APPLY ? "" : "would-"}rewrite=${totals.rewritten} unchanged=${totals.unchanged} failed=${totals.failed} ═══`
  );
  if (!APPLY) console.log(`Re-run with --apply to write. Read the rollout spec FIRST.`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
