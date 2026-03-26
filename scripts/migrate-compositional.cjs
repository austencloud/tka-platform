/**
 * Migration Script: Three-Tier Compositional Sequence Model
 *
 * Reads all sequences from Firestore (user libraries + public sequences) and
 * decomposes each one into its compositional fields:
 *   - blueSoloProp / redSoloProp  (solo prop paths)
 *   - stepPairings                (per-beat pairing data)
 *   - blueSoloHash / redSoloHash  (content hashes)
 *
 * Existing steps[] are preserved — this script only ADDS new fields.
 *
 * Usage:
 *   node scripts/migrate-compositional.cjs              # live run
 *   node scripts/migrate-compositional.cjs --dry-run    # report only
 */

const admin = require("firebase-admin");
const { readFileSync } = require("fs");
const { join } = require("path");
const { decomposeSequence } = require("./lib/compose-sequence.cjs");

const SERVICE_ACCOUNT_PATH = join(__dirname, "..", "serviceAccountKey.json");

function initFirebase() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(SERVICE_ACCOUNT_PATH, "utf-8")
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin.firestore();
  } catch (err) {
    console.error("Failed to initialize Firebase.");
    console.error(`  Expected service account at: ${SERVICE_ACCOUNT_PATH}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Firestore traversal
// ---------------------------------------------------------------------------

async function migrateCollection(db, collectionPath, stats) {
  const snapshot = await db.collection(collectionPath).get();
  const docs = snapshot.docs;

  if (docs.length === 0) return;

  console.log(`  ${collectionPath}: ${docs.length} documents`);

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of docs) {
    const data = doc.data();

    // Already migrated — skip
    if (data.blueSoloProp) {
      stats.alreadyMigrated++;
      continue;
    }

    // No steps to decompose — skip
    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      stats.skipped++;
      continue;
    }

    try {
      const compositionalFields = decomposeSequence(data);
      if (!compositionalFields) {
        stats.skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `    [dry-run] Would migrate: ${doc.id} (${data.word || data.name || "unnamed"}, ${data.steps.length} steps)`
        );
      } else {
        batch.update(doc.ref, compositionalFields);
        batchCount++;

        // Flush batch when it hits the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      stats.migrated++;
    } catch (err) {
      stats.errors++;
      console.error(
        `    ERROR on ${collectionPath}/${doc.id}: ${err.message}`
      );
    }
  }

  // Flush remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }
}

async function migrateUserSequences(db, stats) {
  // Get all user documents that have a sequences subcollection.
  // Firestore doesn't let us list subcollections across all users in one call,
  // so we iterate over all user documents.
  const usersSnapshot = await db.collection("users").get();
  console.log(`  Found ${usersSnapshot.docs.length} user documents`);

  for (const userDoc of usersSnapshot.docs) {
    const seqPath = `users/${userDoc.id}/sequences`;
    const seqSnapshot = await db.collection(seqPath).limit(1).get();
    if (!seqSnapshot.empty) {
      await migrateCollection(db, seqPath, stats);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\nCompositional Sequence Migration${DRY_RUN ? " (DRY RUN)" : ""}\n`
  );
  console.log("Connecting to Firestore...");

  const db = initFirebase();

  const stats = {
    migrated: 0,
    alreadyMigrated: 0,
    skipped: 0,
    errors: 0,
  };

  // 1. Public sequences
  console.log("\nProcessing publicSequences...");
  await migrateCollection(db, "publicSequences", stats);

  // 2. User sequences
  console.log("\nProcessing user sequences...");
  await migrateUserSequences(db, stats);

  // Report
  console.log("\n--- Migration Summary ---");
  console.log(`  Migrated:         ${stats.migrated}`);
  console.log(`  Already migrated: ${stats.alreadyMigrated}`);
  console.log(`  Skipped (no steps): ${stats.skipped}`);
  console.log(`  Errors:           ${stats.errors}`);

  if (DRY_RUN) {
    console.log("\n  (Dry run — no documents were modified)\n");
  } else {
    console.log("\n  Done.\n");
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
