/**
 * Remove startPosition/endPosition Fields Migration
 *
 * Removes the startPosition and endPosition fields from all beats/steps in sequences.
 * These fields are now derived on-the-fly from motion location data using GridPositionDeriver.
 *
 * Usage:
 *   node scripts/remove-position-fields.js --dry-run     # Preview changes
 *   node scripts/remove-position-fields.js               # Execute migration
 *   node scripts/remove-position-fields.js --user <uid>  # Migrate single user
 *
 * Safety:
 *   - Always run with --dry-run first to preview changes
 *   - Uses batch writes for efficiency
 *   - Reports progress and errors
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const userIndex = args.indexOf("--user");
const singleUserId = userIndex !== -1 ? args[userIndex + 1] : null;

/**
 * Check if a beat/step has position fields that need removal
 */
function hasPositionFields(beat) {
  return (
    beat &&
    typeof beat === "object" &&
    ("startPosition" in beat || "endPosition" in beat)
  );
}

/**
 * Remove position fields from a beat object
 * Returns the cleaned beat or null if no changes needed
 */
function removePositionFields(beat) {
  if (!hasPositionFields(beat)) {
    return null;
  }

  const cleaned = { ...beat };
  delete cleaned.startPosition;
  delete cleaned.endPosition;
  return cleaned;
}

/**
 * Process a single sequence document
 * Returns update data if changes are needed, null otherwise
 */
function processSequence(sequenceData) {
  let hasChanges = false;
  const updates = {};

  // Check 'beats' array (newer format)
  if (Array.isArray(sequenceData.beats)) {
    const cleanedBeats = sequenceData.beats.map((beat) => {
      if (hasPositionFields(beat)) {
        hasChanges = true;
        const cleaned = { ...beat };
        delete cleaned.startPosition;
        delete cleaned.endPosition;
        return cleaned;
      }
      return beat;
    });

    if (hasChanges) {
      updates.beats = cleanedBeats;
    }
  }

  // Check 'steps' array (alternate format)
  if (Array.isArray(sequenceData.steps)) {
    let stepsChanged = false;
    const cleanedSteps = sequenceData.steps.map((step) => {
      if (hasPositionFields(step)) {
        stepsChanged = true;
        hasChanges = true;
        const cleaned = { ...step };
        delete cleaned.startPosition;
        delete cleaned.endPosition;
        return cleaned;
      }
      return step;
    });

    if (stepsChanged) {
      updates.steps = cleanedSteps;
    }
  }

  // Check top-level startPosition/endPosition (sequence-level)
  if ("startPosition" in sequenceData) {
    hasChanges = true;
    updates.startPosition = FieldValue.delete();
  }
  if ("endPosition" in sequenceData) {
    hasChanges = true;
    updates.endPosition = FieldValue.delete();
  }

  return hasChanges ? updates : null;
}

/**
 * Migrate sequences for a single user
 */
async function migrateUserSequences(userId, stats) {
  const sequencesRef = db.collection("users").doc(userId).collection("sequences");
  const snapshot = await sequencesRef.get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 500;

  for (const doc of snapshot.docs) {
    stats.totalSequences++;

    try {
      const data = doc.data();
      const updates = processSequence(data);

      if (updates) {
        stats.sequencesWithPositionFields++;

        if (!dryRun) {
          batch.update(doc.ref, updates);
          batchCount++;

          // Commit batch if it reaches max size
          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batchCount = 0;
          }
        }

        if (stats.sequencesWithPositionFields <= 5) {
          // Show first few examples
          console.log(`  📝 ${doc.id} (${data.word || "unnamed"})`);
        }
      }
    } catch (err) {
      stats.errors++;
      console.error(`  ❌ Error processing ${doc.id}:`, err.message);
    }
  }

  // Commit remaining batch
  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log(`\n🔄 Position Fields Removal Migration${dryRun ? " (DRY RUN)" : ""}\n`);

  if (singleUserId) {
    console.log(`Targeting single user: ${singleUserId}\n`);
  }

  const stats = {
    totalUsers: 0,
    totalSequences: 0,
    sequencesWithPositionFields: 0,
    errors: 0,
  };

  try {
    if (singleUserId) {
      // Single user migration
      stats.totalUsers = 1;
      console.log(`Processing user: ${singleUserId}`);
      await migrateUserSequences(singleUserId, stats);
    } else {
      // All users migration
      const usersSnapshot = await db.collection("users").get();
      stats.totalUsers = usersSnapshot.size;

      console.log(`Found ${stats.totalUsers} users\n`);

      let userCount = 0;
      for (const userDoc of usersSnapshot.docs) {
        userCount++;
        if (userCount % 10 === 0 || userCount === 1) {
          console.log(`Processing user ${userCount}/${stats.totalUsers}...`);
        }

        await migrateUserSequences(userDoc.id, stats);
      }
    }

    // Also check public sequences collection if it exists
    console.log("\nChecking public sequences...");
    try {
      const publicRef = db.collection("publicSequences");
      const publicSnapshot = await publicRef.get();

      if (!publicSnapshot.empty) {
        const batch = db.batch();
        let batchCount = 0;
        const MAX_BATCH_SIZE = 500;

        for (const doc of publicSnapshot.docs) {
          stats.totalSequences++;

          try {
            const data = doc.data();
            const updates = processSequence(data);

            if (updates) {
              stats.sequencesWithPositionFields++;

              if (!dryRun) {
                batch.update(doc.ref, updates);
                batchCount++;

                if (batchCount >= MAX_BATCH_SIZE) {
                  await batch.commit();
                  batchCount = 0;
                }
              }
            }
          } catch (err) {
            stats.errors++;
          }
        }

        if (!dryRun && batchCount > 0) {
          await batch.commit();
        }

        console.log(`  Found ${publicSnapshot.size} public sequences`);
      }
    } catch (err) {
      console.log("  No publicSequences collection or access denied");
    }

  } catch (err) {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  }

  // Print results
  console.log("\n" + "=".repeat(60));
  console.log("📊 Migration Results\n");
  console.log(`Total users processed:       ${stats.totalUsers}`);
  console.log(`Total sequences scanned:     ${stats.totalSequences}`);
  console.log(`Sequences with position fields: ${stats.sequencesWithPositionFields}`);
  console.log(`Errors:                      ${stats.errors}`);
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("\n⚠️  DRY RUN - No changes were made.");
    console.log("Run without --dry-run to apply changes.\n");
  } else if (stats.sequencesWithPositionFields > 0) {
    console.log(`\n✅ Successfully removed position fields from ${stats.sequencesWithPositionFields} sequences!\n`);
  } else {
    console.log("\n✅ No sequences needed migration.\n");
  }

  process.exit(0);
}

// Run the migration
runMigration();
