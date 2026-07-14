// Sweep publicSequences for stale mirrors: docs whose owner's sequence doc is
// missing or no longer visibility=public. Dry run by default; pass --apply to delete.
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const APPLY = process.argv.includes("--apply");
const key = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

const snap = await db.collection("publicSequences").get();
console.log(`publicSequences docs: ${snap.size}`);
const stale = [];
for (const d of snap.docs) {
  const ownerId = d.data().ownerId;
  if (!ownerId) { stale.push({ id: d.id, reason: "no ownerId" }); continue; }
  const seq = await db.doc(`users/${ownerId}/sequences/${d.id}`).get();
  if (!seq.exists) stale.push({ id: d.id, ownerId, reason: "source doc missing" });
  else if (seq.data().visibility !== "public")
    stale.push({ id: d.id, ownerId, reason: `visibility=${seq.data().visibility}` });
}
console.log(`stale: ${stale.length}`);
for (const s of stale) console.log(` ${s.id} owner=${s.ownerId ?? "-"} (${s.reason})`);

if (APPLY && stale.length) {
  for (const s of stale) await db.doc(`publicSequences/${s.id}`).delete();
  console.log(`deleted ${stale.length}`);
} else if (stale.length) {
  console.log("dry run — rerun with --apply to delete");
}
