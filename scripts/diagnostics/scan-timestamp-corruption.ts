/** READ-ONLY. How widespread is the serverTimestamp-sentinel corruption
 *  (createdAt/updatedAt stored as {_methodName:"serverTimestamp"} objects)? */
import { initFirestore } from "../lib/firestore-provider.js";
type AnyRec = Record<string, unknown>;
const USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";

function isSentinel(v: unknown): boolean {
  return !!v && typeof v === "object" && "_methodName" in (v as AnyRec);
}

async function scan(db: AnyRec, path: string): Promise<void> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let total = 0, bad = 0;
  const sample: string[] = [];
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec }>)) {
    total++;
    const data = d.data();
    if (isSentinel(data["createdAt"]) || isSentinel(data["updatedAt"]) || isSentinel(data["birthday"])) {
      bad++;
      if (sample.length < 15) sample.push(`"${data["word"] ?? ""}" ${d.id}`);
    }
  }
  console.log(`\n${path}: ${bad}/${total} docs with sentinel timestamp(s)`);
  sample.forEach((s) => console.log(`  ${s}`));
}

async function main(): Promise<void> {
  const { db, sdk } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk}`);
  await scan(db, `users/${USER}/sequences`);
  await scan(db, "publicSequences");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
