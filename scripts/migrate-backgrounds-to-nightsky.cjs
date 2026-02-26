/**
 * Background Migration Script (v2)
 *
 * Migrates ALL users who should have nightSky but don't:
 *   1. Users with solidColor + #000000 (old explicit default)
 *   2. Users with solidColor + no backgroundColor (old implicit default)
 *   3. Users with no backgroundType at all (never set one)
 *   4. Users with no settings doc (creates one with nightSky)
 *
 * Safe to re-run — only touches users who match the old default patterns.
 *
 * Prerequisites:
 *   Ensure firebase-service-account.json exists in project root
 *
 * Usage:
 *   node scripts/migrate-backgrounds-to-nightsky.cjs --dry-run    # Preview changes
 *   node scripts/migrate-backgrounds-to-nightsky.cjs              # Execute migration
 */

const admin = require("firebase-admin");
const path = require("path");

// Parse arguments
const DRY_RUN = process.argv.includes("--dry-run");

// Initialize Firebase Admin — try both service account file names
const SERVICE_ACCOUNT_PATHS = [
  path.join(__dirname, "..", "firebase-service-account.json"),
  path.join(__dirname, "..", "serviceAccountKey.json"),
];

let initialized = false;
for (const saPath of SERVICE_ACCOUNT_PATHS) {
  try {
    const serviceAccount = require(saPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(`Using service account: ${path.basename(saPath)}`);
    initialized = true;
    break;
  } catch (_) {
    // Try next path
  }
}

if (!initialized) {
  console.error("Failed to load service account key.");
  console.error("Ensure firebase-service-account.json or serviceAccountKey.json exists in project root.");
  process.exit(1);
}

const db = admin.firestore();

// Stats
const stats = {
  totalUsers: 0,
  usersWithSettings: 0,
  migratedFromSolidColor: 0,
  migratedNoBackgroundType: 0,
  migratedNoSettingsDoc: 0,
  alreadyCustom: 0,
  errors: 0,
};

function isOldDefault(data) {
  const bgType = data.backgroundType;
  const bgColor = data.backgroundColor;

  // Case 1: Explicitly solidColor with black or no color
  if (bgType === "solidColor" && (!bgColor || bgColor === "#000000")) {
    return "solidColor";
  }

  // Case 2: No backgroundType field at all — was using code default
  if (bgType === undefined || bgType === null) {
    return "noBackgroundType";
  }

  return false;
}

async function migrate() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Background Migration v2: old defaults → nightSky`);
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`${"=".repeat(60)}\n`);

  // Get all user documents
  const usersSnapshot = await db.collection("users").get();
  stats.totalUsers = usersSnapshot.size;
  console.log(`Found ${stats.totalUsers} users\n`);

  // Firestore batched writes (max 500 per batch)
  let batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 500;

  async function commitIfNeeded() {
    if (batchCount >= BATCH_LIMIT) {
      if (!DRY_RUN) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} updates`);
      }
      batch = db.batch();
      batchCount = 0;
    }
  }

  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;

    try {
      const settingsRef = db.doc(`users/${uid}/settings/preferences`);
      const settingsSnap = await settingsRef.get();

      if (!settingsSnap.exists) {
        // Case 4: No settings doc at all — create one with nightSky
        console.log(`  [CREATE] ${uid}: no settings doc → nightSky`);
        stats.migratedNoSettingsDoc++;

        if (!DRY_RUN) {
          batch.set(settingsRef, {
            backgroundType: "nightSky",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          batchCount++;
          await commitIfNeeded();
        }
        continue;
      }

      stats.usersWithSettings++;
      const data = settingsSnap.data();
      const defaultCase = isOldDefault(data);

      if (!defaultCase) {
        stats.alreadyCustom++;
        continue;
      }

      if (defaultCase === "solidColor") {
        console.log(`  [MIGRATE] ${uid}: solidColor/#000000 → nightSky`);
        stats.migratedFromSolidColor++;
      } else if (defaultCase === "noBackgroundType") {
        console.log(`  [MIGRATE] ${uid}: no backgroundType → nightSky`);
        stats.migratedNoBackgroundType++;
      }

      if (!DRY_RUN) {
        batch.update(settingsRef, {
          backgroundType: "nightSky",
          backgroundColor: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount++;
        await commitIfNeeded();
      }
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
  const totalMigrated =
    stats.migratedFromSolidColor +
    stats.migratedNoBackgroundType +
    stats.migratedNoSettingsDoc;

  console.log(`\n${"=".repeat(60)}`);
  console.log("  Results:");
  console.log(`    Total users:             ${stats.totalUsers}`);
  console.log(`    With settings doc:       ${stats.usersWithSettings}`);
  console.log(`    Already custom:          ${stats.alreadyCustom}`);
  console.log(`    Migrated (solidColor):   ${stats.migratedFromSolidColor}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`    Migrated (no bgType):    ${stats.migratedNoBackgroundType}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`    Migrated (no doc):       ${stats.migratedNoSettingsDoc}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`    Total migrated:          ${totalMigrated}${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`    Errors:                  ${stats.errors}`);
  console.log(`${"=".repeat(60)}\n`);

  if (DRY_RUN && totalMigrated > 0) {
    console.log("  Run without --dry-run to apply these changes.\n");
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
