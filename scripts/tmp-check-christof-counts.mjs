import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const key = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

// Find Christof's uid
const users = await db.collection("users").get();
let uid = null;
for (const u of users.docs) {
  const d = u.data();
  const name = (d.displayName ?? d.username ?? "").toLowerCase();
  if (name.includes("christof")) { uid = u.id; console.log("user:", u.id, d.displayName ?? d.username); }
}
if (!uid) { console.log("not found"); process.exit(1); }

const cols = await db.collection(`users/${uid}/collections`).get();
for (const c of cols.docs) {
  const d = c.data();
  console.log(`\ncollection ${c.id} "${d.name}" isPublic=${d.isPublic} storedCount=${d.sequenceCount} ids=${(d.sequenceIds ?? []).length}`);
  for (const id of d.sequenceIds ?? []) {
    const seq = await db.doc(`users/${uid}/sequences/${id}`).get();
    const pub = await db.doc(`publicSequences/${id}`).get();
    console.log(`  ${id}: seqDoc=${seq.exists ? `visibility=${seq.data().visibility} word=${seq.data().word ?? seq.data().name}` : "MISSING"} | publicIndex=${pub.exists ? "EXISTS" : "absent"}`);
  }
}
