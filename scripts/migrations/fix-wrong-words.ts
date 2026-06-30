/**
 * Correct `word` on docs whose stored word's LETTERS genuinely disagree with the
 * step-derived word (the steps are canonical). Uses the same refined check as the
 * audit: a LOOP's seed vs full-expansion (one a prefix of the other) is the
 * expected convention and is NOT touched — only real letter-mismatches.
 * Scoped to one collection (default publicSequences). TKA_ADMIN=1 for other owners.
 *
 *   npx tsx scripts/migrations/fix-wrong-words.ts                     # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/fix-wrong-words.ts --apply
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

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} (admin=${isAdmin}) — ${APPLY ? "APPLY" : "DRY-RUN"} — ${path}`);
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let fixed = 0, failed = 0;
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    const word = data["word"];
    if (typeof word !== "string" || word.trim() === "") continue;
    if (!Array.isArray(data["stepPairings"]) || (data["stepPairings"] as unknown[]).length === 0) continue;

    let derived = "";
    try { derived = deriveWord(hydrate({ ...(data as object), id: d.id } as SequenceData) as SequenceData); } catch { continue; }
    // Only a genuine letter-mismatch (neither string is a prefix of the other).
    if (!derived || derived === word || derived.startsWith(word) || word.startsWith(derived)) continue;

    const updates: AnyRec = { word: derived };
    if (data["name"] === word || data["name"] === "" || /^Sequence \d/.test(String(data["name"]))) {
      updates["name"] = derived;
    }
    if (APPLY) {
      try { await (d.ref as AnyRec)["update"](updates); }
      catch (e) { failed++; console.log(`  ❌ ${d.id} — ${e instanceof Error ? e.message : e}`); continue; }
    }
    fixed++;
    console.log(`  ${APPLY ? "✅" : "·"} ${d.id}  "${word}" → "${derived}"`);
  }
  console.log(`\n${APPLY ? "fixed" : "would-fix"}=${fixed} failed=${failed}`);
  if (!APPLY) console.log(`Re-run with --apply to write.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
