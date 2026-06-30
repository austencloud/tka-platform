/** READ-ONLY. Inspect the small-cruft docs to decide populate-vs-delete. */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import { deriveWord } from "../../src/lib/shared/foundation/services/word-deriver";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

type AnyRec = Record<string, unknown>;
const USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const IDS = [
  "seq_1771551631385_tqk9d3r23", // empty word
  "seq_1773999581288_9yokhlr24", // empty word
  "3c529b27-bcf4-4f77-9471-d585d7da0a59", // word mismatch
  "498bcf5d-ba31-453b-8529-fd0b8967df20", // EKEK orphan mirror (source private)
];

async function main(): Promise<void> {
  const { db } = (await initFirestore()) as AnyRec & { db: AnyRec };
  for (const id of IDS) {
    const snap = await (db.collection as (p: string) => AnyRec)(`users/${USER}/sequences`)["doc"](id)["get"]();
    const data = snap.data() as AnyRec | undefined;
    if (!data) { console.log(`\n[${id}] MISSING from library`); continue; }
    const pairings = Array.isArray(data["stepPairings"]) ? (data["stepPairings"] as unknown[]).length : 0;
    let dw = "?";
    try { dw = deriveWord(hydrate({ ...(data as object), id } as SequenceData) as SequenceData); } catch (e) { dw = `ERR ${e instanceof Error ? e.message : e}`; }
    console.log(`\n[${id}]`);
    console.log(`  word=${JSON.stringify(data["word"])} name=${JSON.stringify(data["name"])} visibility=${data["visibility"]}`);
    console.log(`  stepPairings=${pairings} derivedWord="${dw}"`);
    console.log(`  source=${data["source"]} collectionIds=${JSON.stringify(data["collectionIds"])} isFavorite=${data["isFavorite"]}`);
    const pub = await (db.collection as (p: string) => AnyRec)("publicSequences")["doc"](id)["get"]();
    console.log(`  publicMirror exists=${!!pub.data()}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
