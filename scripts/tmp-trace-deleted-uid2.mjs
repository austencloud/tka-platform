// Read-only: full devices + onboarding docs for the deleted uid — when was it last active?
import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const uid = "RMTg4iBHpBNhHbgGju2Xwpzh9C82";

for (const coll of ["devices", "onboarding"]) {
  const s = await db.collection(`users/${uid}/${coll}`).get();
  s.docs.forEach((d) => {
    const data = d.data();
    for (const [k, v] of Object.entries(data)) {
      if (v?.toDate) data[k] = v.toDate().toISOString();
    }
    console.log(`${coll}/${d.id}:`, JSON.stringify(data, null, 1));
  });
}
process.exit(0);
