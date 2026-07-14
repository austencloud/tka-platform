// One-off: archive then delete skeleton users/{uid} docs — docs minted by the
// pre-fix mirrorActiveProp merge write (activeProp only, no displayName).
// These render as "Unknown" in the admin users tab. Verified 2026-07-12:
// 4 anonymous auth accounts + 1 with no auth record.
import admin from "firebase-admin";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
const serviceAccount = JSON.parse(readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Safety: only fields a skeleton can carry. Anything else → skip, not a skeleton.
const SKELETON_FIELDS = new Set(["activeProp", "lastLocation"]);

const snap = await db.collection("users").get();
const skeletons = snap.docs.filter((d) => {
  const data = d.data();
  return !data.displayName && Object.keys(data).every((k) => SKELETON_FIELDS.has(k));
});
console.log(`users total: ${snap.size}, skeletons: ${skeletons.length}`);
skeletons.forEach((d) => console.log(" -", d.id, Object.keys(d.data()).join(",")));

mkdirSync("E:/tka-platform/scripts/migrations/backups", { recursive: true });
const archivePath = `E:/tka-platform/scripts/migrations/backups/skeleton-users-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(
  archivePath,
  JSON.stringify(skeletons.map((d) => ({ path: d.ref.path, data: d.data() })), null, 1)
);
console.log("archived to", archivePath);

const batch = db.batch();
for (const d of skeletons) batch.delete(d.ref);
await batch.commit();
console.log(`deleted ${skeletons.length}`);

const after = await db.collection("users").get();
const remaining = after.docs.filter((d) => !d.data().displayName);
console.log(`users now: ${after.size}, still missing displayName: ${remaining.length}`);
