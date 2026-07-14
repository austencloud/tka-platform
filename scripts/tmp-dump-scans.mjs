import admin from "firebase-admin";
import { readFileSync, writeFileSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collectionGroup("scanEvents").get();
console.log("total scanEvents:", snap.size);

const rows = snap.docs.map((d) => {
  const v = d.data();
  const code = d.ref.parent.parent?.id ?? null;
  const ts = v.timestamp?.toDate?.() ?? v.timestamp ?? null;
  return {
    code,
    city: v.city ?? null,
    region: v.region ?? null,
    country: v.country ?? null,
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    timestamp: ts instanceof Date ? ts.toISOString() : ts,
    printId: v.printId ?? null,
    userId: v.userId ?? null,
    userAgent: v.userAgent ?? null,
  };
});
writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
console.log("wrote", rows.length, "rows");
