import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const SID = "1cb66d9e-39ec-4547-bd1e-3ea89967cca9";
const own = await db.doc(`users/${UID}/sequences/${SID}`).get();
console.log("own doc exists:", own.exists);
const pub = await db.doc(`publicSequences/${SID}`).get();
console.log("public index doc exists:", pub.exists);
if (own.exists) {
  const d = own.data();
  console.log("word:", d.word, "visibility:", d.visibility, "steps:", Array.isArray(d.steps) ? d.steps.length : "NO", "pairings:", Array.isArray(d.stepPairings) ? d.stepPairings.length : "NO");
}
process.exit(0);
