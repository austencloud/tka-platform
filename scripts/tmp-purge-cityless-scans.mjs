// One-off: archive then delete every scanEvents doc without a city.
// Directive 2026-07-09: city-less scans shouldn't exist anywhere — city
// matters more than country, and history never captured it.
import admin from "firebase-admin";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const snap = await db.collectionGroup("scanEvents").get();
const cityless = snap.docs.filter((d) => !d.data().city);
console.log(`scanEvents total: ${snap.size}, city-less: ${cityless.length}, kept: ${snap.size - cityless.length}`);

// Archive full docs (path + data) before deleting anything.
mkdirSync("E:/tka-platform/scripts/migrations/backups", { recursive: true });
const archivePath = `E:/tka-platform/scripts/migrations/backups/scan-events-cityless-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(
  archivePath,
  JSON.stringify(cityless.map((d) => ({ path: d.ref.path, data: d.data() })), null, 1)
);
console.log("archived to", archivePath);

let deleted = 0;
while (deleted < cityless.length) {
  const batch = db.batch();
  for (const d of cityless.slice(deleted, deleted + 400)) batch.delete(d.ref);
  await batch.commit();
  deleted = Math.min(deleted + 400, cityless.length);
  console.log(`deleted ${deleted}/${cityless.length}`);
}
const after = await db.collectionGroup("scanEvents").get();
console.log(`remaining scanEvents: ${after.size} (all with city:`, after.docs.every((d) => !!d.data().city), ")");
