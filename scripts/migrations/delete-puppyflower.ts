/**
 * Permanently delete the Δ-QZ- "puppyflower" sequence the user could not remove
 * in-app (deleteSequence swallows failures). Removes BOTH the owner's source doc
 * and the public-gallery mirror. Owner-authorized.
 *
 *   npx tsx scripts/migrations/delete-puppyflower.ts            # dry-run
 *   npx tsx scripts/migrations/delete-puppyflower.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;
const USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const ID = "seq_1778908018922_16c7s0zaj";
const APPLY = process.argv.slice(2).includes("--apply");

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`Firestore via ${sdk} (admin=${isAdmin}) — ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const srcRef = (db.collection as (p: string) => AnyRec)(`users/${USER}/sequences`)["doc"](ID);
  const pubRef = (db.collection as (p: string) => AnyRec)("publicSequences")["doc"](ID);

  const src = await (srcRef as AnyRec)["get"]();
  const pub = await (pubRef as AnyRec)["get"]();
  console.log(`source  users/${USER}/sequences/${ID}: exists=${!!src.data()} word=${src.data()?.["word"]}`);
  console.log(`mirror  publicSequences/${ID}:          exists=${!!pub.data()} word=${pub.data()?.["word"]}`);

  if (APPLY) {
    if (src.data()) { await (srcRef as AnyRec)["delete"](); console.log("  ✅ deleted source doc"); }
    if (pub.data()) { await (pubRef as AnyRec)["delete"](); console.log("  ✅ deleted public mirror"); }

    // Verify
    const s2 = await (srcRef as AnyRec)["get"]();
    const p2 = await (pubRef as AnyRec)["get"]();
    console.log(`  post-delete: source exists=${!!s2.data()}  mirror exists=${!!p2.data()}`);
  } else {
    console.log("  (dry-run — would delete both)");
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
