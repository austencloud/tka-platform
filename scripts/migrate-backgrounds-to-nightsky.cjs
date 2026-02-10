/**
 * Background Migration Script
 *
 * Migrates users with the old default background (solidColor + #000000)
 * to the new default (nightSky). This is a one-time server-side migration
 * so that Firebase-synced settings reflect the new default.
 *
 * Prerequisites:
 *   Ensure serviceAccountKey.json exists in project root
 *
 * Usage:
 *   node scripts/migrate-backgrounds-to-nightsky.cjs --dry-run    # Preview changes
 *   node scripts/migrate-backgrounds-to-nightsky.cjs              # Execute migration
 */

const admin = require("firebase-admin");
const path = require("path");

// Parse arguments
const DRY_RUN = process.argv.includes("--dry-run");

// Initialize Firebase Admin
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");

try {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (err) {
  console.error("Failed to load service account key from:", SERVICE_ACCOUNT_PATH);
  console.error("Ensure serviceAccountKey.json exists in the project root.");
  process.exit(1);
}

const db = admin.firestore();

// Stats
const stats = {
  totalUsers: 0,
  usersWithSettings: 0,
  migrated: 0,
  alreadyCustom: 0,
  noSettings: 0,
  errors: 0,
};

async function migrate() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Background Migration: solidColor #000000 → nightSky`);
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`${"=".repeat(60)}\n`);

  // Get all user documents
  const usersSnapshot = await db.collection("users").get();
  stats.totalUsers = usersSnapshot.size;
  console.log(`Found ${stats.totalUsers} users\n`);

  // Process in batches of 500 (Firestore batch limit)
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 500;

  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;

    try {
      const settingsRef = db.doc(`users/${uid}/settings/preferences`);
      const settingsSnap = await settingsRef.get();

      if (!settingsSnap.exists) {
        stats.noSettings++;
        continue;
      }

      stats.usersWithSettings++;
      const data = settingsSnap.data();
      const bgType = data.backgroundType;
      const bgColor = data.backgroundColor;

      // Check if this user has the old default
      const isOldDefault =
        bgType === "solidColor" &&
        (!bgColor || bgColor === "#000000");

      if (!isOldDefault) {
        stats.alreadyCustom++;
        continue;
      }

      // This user needs migration
      console.log(`  [MIGRATE] ${uid}: solidColor/#000000 → nightSky`);

      if (!DRY_RUN) {
        batch.update(settingsRef, {
          backgroundType: "nightSky",
          backgroundColor: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount++;

        // Commit batch if at limit
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit();
          console.log(`  Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }

      stats.migrated++;
    } catch (err) {
      stats.errors++;
      console.error(`  [ERROR] ${uid}: ${err.message}`);
    }
  }

  // Commit remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} updates`);
  }

  // Report
  console.log(`\n${"=".repeat(60)}`);
  console.log("  Results:");
  console.log(`    Total users:        ${stats.totalUsers}`);
  console.log(`    With settings:      ${stats.usersWithSettings}`);
  console.log(`    No settings doc:    ${stats.noSettings}`);
  console.log(`    Already custom:     ${stats.alreadyCustom}`);
  console.log(`    Migrated:           ${stats.migrated}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`    Errors:             ${stats.errors}`);
  console.log(`${"=".repeat(60)}\n`);

  if (DRY_RUN && stats.migrated > 0) {
    console.log("  Run without --dry-run to apply these changes.\n");
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
