/**
 * Quick correctness fixes from the 2026-06-29 cruft audit:
 *   1. Populate / correct `word` (+ name) from the step-derived word for the
 *      empty-word and wrong-word docs. Updates the public mirror too when present.
 *   2. Remove orphan public mirrors — publicSequences docs whose source sequence
 *      is private (or gone). Found dynamically among Austen-owned mirrors.
 *
 *   npx tsx scripts/migrations/fix-cruft-quick.ts            # dry-run
 *   npx tsx scripts/migrations/fix-cruft-quick.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import { deriveWord } from "../../src/lib/shared/foundation/services/word-deriver";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

type AnyRec = Record<string, unknown>;
const USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const APPLY = process.argv.slice(2).includes("--apply");

const WORD_FIX_IDS = [
  "seq_1771551631385_tqk9d3r23", // empty word, steps = LFLFLFLF
  "seq_1773999581288_9yokhlr24", // empty word + junk name, steps = MPMP
  "3c529b27-bcf4-4f77-9471-d585d7da0a59", // word disagrees with steps
];

async function main(): Promise<void> {
  const { db, sdk } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"}`);

  // ── 1. Word fixes ──────────────────────────────────────────────
  console.log(`\n──────── word fixes ────────`);
  for (const id of WORD_FIX_IDS) {
    const libRef = (db.collection as (p: string) => AnyRec)(`users/${USER}/sequences`)["doc"](id);
    const snap = await (libRef as AnyRec)["get"]();
    const data = snap.data() as AnyRec | undefined;
    if (!data) { console.log(`  · ${id} MISSING`); continue; }
    let derived = "";
    try { derived = deriveWord(hydrate({ ...(data as object), id } as SequenceData) as SequenceData); } catch { /* */ }
    if (!derived) { console.log(`  ⚠️  ${id} — could not derive word, skipping`); continue; }
    console.log(`  ${APPLY ? "✅" : "·"} ${id}  word ${JSON.stringify(data["word"])} → "${derived}"`);
    if (APPLY) {
      await (libRef as AnyRec)["update"]({ word: derived, name: derived });
      const pubRef = (db.collection as (p: string) => AnyRec)("publicSequences")["doc"](id);
      const pub = await (pubRef as AnyRec)["get"]();
      if (pub.data()) {
        try { await (pubRef as AnyRec)["update"]({ word: derived, name: derived }); console.log(`       (mirror updated)`); }
        catch (e) { console.log(`       mirror update failed: ${e instanceof Error ? e.message : e}`); }
      }
    }
  }

  // ── 2. Orphan public mirrors (source private/gone) ─────────────
  console.log(`\n──────── orphan mirror removal ────────`);
  const pubSnap = await (db.collection as (p: string) => AnyRec)("publicSequences")["get"]();
  let removed = 0, failed = 0;
  for (const d of (pubSnap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    const data = d.data();
    if (data["ownerId"] !== USER) continue;
    const src = await (db.collection as (p: string) => AnyRec)(`users/${USER}/sequences`)["doc"](d.id)["get"]();
    const srcData = src.data() as AnyRec | undefined;
    const reason = !srcData ? "source gone" : srcData["visibility"] !== "public" ? `source ${srcData["visibility"]}` : null;
    if (!reason) continue;
    console.log(`  ${APPLY ? "✅" : "·"} remove mirror "${data["word"]}" ${d.id} (${reason})`);
    if (APPLY) {
      try { await (d.ref as AnyRec)["delete"](); removed++; }
      catch (e) { failed++; console.log(`       failed: ${e instanceof Error ? e.message : e}`); }
    } else removed++;
  }
  console.log(`  ${APPLY ? "removed" : "would-remove"}=${removed} failed=${failed}`);

  if (!APPLY) console.log(`\nRe-run with --apply to write.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
