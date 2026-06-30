/**
 * Populate the `word` (+ name when blank/auto) on docs that have a blank word
 * but valid compositional steps. Derives the word from the steps. Scoped to one
 * collection (default publicSequences). Use TKA_ADMIN=1 to reach other owners.
 *
 *   npx tsx scripts/migrations/fix-empty-words.ts                     # dry-run, publicSequences
 *   TKA_ADMIN=1 npx tsx scripts/migrations/fix-empty-words.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import { deriveWord } from "../../src/lib/shared/foundation/services/word-deriver";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

type AnyRec = Record<string, unknown>;
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const path = (() => {
  const i = argv.indexOf("--path");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : "publicSequences";
})();

function isAutoName(name: unknown): boolean {
  return typeof name === "string" && (name === "" || /^Sequence \d/.test(name));
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} (admin=${isAdmin}) — ${APPLY ? "APPLY" : "DRY-RUN"} — ${path}`);
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let scanned = 0, fixed = 0, skipped = 0, failed = 0;
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    scanned++;
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    const word = data["word"];
    if (typeof word === "string" && word.trim() !== "") continue;

    let derived = "";
    try { derived = deriveWord(hydrate({ ...(data as object), id: d.id } as SequenceData) as SequenceData); } catch { /* */ }
    if (!derived || !derived.trim()) {
      skipped++;
      console.log(`  ⚠️  ${d.id} — no derivable word (no steps), skip`);
      continue;
    }
    const updates: AnyRec = { word: derived };
    if (isAutoName(data["name"])) updates["name"] = derived;
    if (APPLY) {
      try { await (d.ref as AnyRec)["update"](updates); }
      catch (e) { failed++; console.log(`  ❌ ${d.id} — ${e instanceof Error ? e.message : e}`); continue; }
    }
    fixed++;
    console.log(`  ${APPLY ? "✅" : "·"} ${d.id} → "${derived}"${updates["name"] ? " (+name)" : ""}`);
  }
  console.log(`\nscanned=${scanned} ${APPLY ? "fixed" : "would-fix"}=${fixed} skipped(no-steps)=${skipped} failed=${failed}`);
  if (!APPLY) console.log(`Re-run with --apply to write.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
