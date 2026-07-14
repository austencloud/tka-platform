// Runtime test: create a throwaway email user, delete it, verify the
// onAuthUserDeleted trigger wrote an accountDeletions tombstone.
import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const u = await admin.auth().createUser({
  email: "tombstone-test@example.com",
  password: "throwaway-test-1234",
  displayName: "Tombstone Test",
});
console.log("created test user", u.uid);
await admin.auth().deleteUser(u.uid);
console.log("deleted test user, waiting for trigger...");

for (let i = 0; i < 12; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const doc = await db.doc(`accountDeletions/${u.uid}`).get();
  if (doc.exists) {
    const d = doc.data();
    console.log("TOMBSTONE:", JSON.stringify({
      ...d,
      accountCreatedAt: d.accountCreatedAt?.toDate?.()?.toISOString?.(),
      deletedAt: d.deletedAt?.toDate?.()?.toISOString?.(),
      expireAt: d.expireAt?.toDate?.()?.toISOString?.(),
    }, null, 1));
    process.exit(0);
  }
  console.log(`poll ${i + 1}: not yet`);
}
console.log("TIMEOUT: no tombstone after 60s");
process.exit(1);
