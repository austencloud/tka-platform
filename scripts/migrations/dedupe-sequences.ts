/**
 * Delete TRUE duplicate sequences: distinct docs with the SAME contentHash AND
 * the same length (loop-vs-period pairs share a contentHash but differ in length,
 * so they are NOT dupes and are left alone).
 *
 * Per group: keep the best copy (favorited > in-collection > public > most-viewed
 * > oldest > id), delete the others — but NEVER delete a copy that is favorited or
 * in a collection (those carry attachments); such groups are reported, not touched.
 * A deleted public doc's mirror is removed too.
 *
 *   npx tsx scripts/migrations/dedupe-sequences.ts                     # dry-run, library
 *   TKA_ADMIN=1 npx tsx scripts/migrations/dedupe-sequences.ts --apply
 *   npx tsx scripts/migrations/dedupe-sequences.ts --path publicSequences
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;
const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const userId = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_USER;
})();
const path = (() => {
  const i = argv.indexOf("--path");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : `users/${userId}/sequences`;
})();

function len(data: AnyRec): number {
  const sp = data["stepPairings"];
  if (Array.isArray(sp)) return sp.length;
  return (data["sequenceLength"] as number) ?? 0;
}
function attached(data: AnyRec): boolean {
  return data["isFavorite"] === true || (Array.isArray(data["collectionIds"]) && (data["collectionIds"] as unknown[]).length > 0);
}
function ms(data: AnyRec): number {
  for (const f of ["birthday", "createdAt"]) {
    const v = data[f] as AnyRec | undefined;
    if (v && typeof v["toMillis"] === "function") return (v["toMillis"] as () => number)();
    if (v && typeof v["seconds"] === "number") return (v["seconds"] as number) * 1000;
    if (v && typeof v["_seconds"] === "number") return (v["_seconds"] as number) * 1000;
  }
  return Number.MAX_SAFE_INTEGER;
}
function score(data: AnyRec): number {
  return (data["isFavorite"] === true ? 1e6 : 0)
    + ((Array.isArray(data["collectionIds"]) && (data["collectionIds"] as unknown[]).length > 0) ? 1e5 : 0)
    + (data["visibility"] === "public" ? 1e4 : 0)
    + ((data["viewCount"] as number) ?? 0)
    + (((data["starCount"] as number) ?? 0) * 100);
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} (admin=${isAdmin}) — ${APPLY ? "APPLY" : "DRY-RUN"} — ${path}`);
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();

  // Group by contentHash + length.
  const groups = new Map<string, Array<{ id: string; data: AnyRec; ref: AnyRec }>>();
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    const ch = data["contentHash"] as string | undefined;
    if (!ch) continue;
    const key = `${ch}|${len(data)}`;
    const list = groups.get(key) ?? [];
    list.push({ id: d.id, data, ref: d.ref });
    groups.set(key, list);
  }

  let deleted = 0, skipped = 0, failed = 0, groupsFound = 0;
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    groupsFound++;
    // Keeper = highest score; tiebreak oldest then id.
    const sorted = [...list].sort((a, b) =>
      score(b.data) - score(a.data) || ms(a.data) - ms(b.data) || a.id.localeCompare(b.id));
    const keeper = sorted[0]!;
    const word = (keeper.data["word"] as string) ?? "";
    console.log(`\n── "${word}" (${key.split("|")[1]} steps) ×${list.length}`);
    console.log(`   KEEP  ${keeper.id}  fav=${keeper.data["isFavorite"]} coll=${JSON.stringify(keeper.data["collectionIds"])} vis=${keeper.data["visibility"]} views=${keeper.data["viewCount"]}`);
    for (const dup of sorted.slice(1)) {
      if (attached(dup.data)) {
        skipped++;
        console.log(`   SKIP  ${dup.id} — attached (fav/collection), not deleting`);
        continue;
      }
      console.log(`   ${APPLY ? "DELETE" : "would-delete"}  ${dup.id}  vis=${dup.data["visibility"]}`);
      if (APPLY) {
        try {
          await (dup.ref as AnyRec)["delete"]();
          // remove public mirror if present
          const mref = (db.collection as (p: string) => AnyRec)("publicSequences")["doc"](dup.id);
          const m = await (mref as AnyRec)["get"]();
          if (m.data()) await (mref as AnyRec)["delete"]();
        } catch (e) {
          failed++;
          console.log(`         failed: ${e instanceof Error ? e.message : e}`);
          continue;
        }
      }
      deleted++;
    }
  }
  console.log(`\n──────── summary ────────`);
  console.log(`true-dupe groups: ${groupsFound}  ${APPLY ? "deleted" : "would-delete"}: ${deleted}  skipped(attached): ${skipped}  failed: ${failed}`);
  if (!APPLY) console.log(`Re-run with --apply to delete.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
