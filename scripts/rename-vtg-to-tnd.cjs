/**
 * Renames collection field from 'VTG' to 'TnD' on all matching deck documents in Firestore.
 *
 * Usage:
 *   node scripts/rename-vtg-to-tnd.cjs --dry-run   # preview only
 *   node scripts/rename-vtg-to-tnd.cjs              # apply changes
 */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
const sa = require(serviceAccountPath);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(dryRun ? "[DRY RUN] Preview mode — no writes.\n" : "[LIVE] Writing updates.\n");

  const snapshot = await db
    .collection("catalogs")
    .where("collection", "==", "VTG")
    .get();

  if (snapshot.empty) {
    console.log("No documents found with collection == 'VTG'.");
    return;
  }

  console.log(`Found ${snapshot.size} documents to update.\n`);

  if (dryRun) {
    snapshot.forEach((doc) => {
      console.log(`  would update: ${doc.id}`);
    });
    console.log(`\n[DRY RUN] ${snapshot.size} documents would be updated. Re-run without --dry-run to apply.`);
    return;
  }

  const batch = db.batch();
  snapshot.forEach((doc) => {
    console.log(`  updating: ${doc.id}`);
    batch.update(doc.ref, { collection: "TnD" });
  });

  await batch.commit();
  console.log(`\nDone. ${snapshot.size} documents updated: collection 'VTG' -> 'TnD'.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
