/**
 * Backfill Start Position Script
 *
 * Populates the `startPosition` field on sequences that are missing it.
 * Checks both publicSequences and user library collections.
 *
 * For compositional-only public sequences (no steps stored), resolves the
 * sourceRef to the user's library doc and copies startPosition from there.
 *
 * Why: startPosition was previously stripped during save (LibraryRepository set
 * it to undefined). Without it, the 3D viewer has no beat-0 config and the
 * avatar plays one beat ahead of the choreo card.
 *
 * Usage:
 *   node scripts/backfill-start-position.cjs           # Dry run (preview)
 *   node scripts/backfill-start-position.cjs --commit  # Write to Firestore
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const isCommit = process.argv.includes("--commit");

/**
 * Derive a StartPositionData object from the first motion step.
 * Uses startLocation/startOrientation from each hand's motion as
 * a static hold (no movement, no rotation).
 */
function deriveStartPosition(steps, sequenceId) {
  if (!steps || steps.length === 0) return null;

  // Find the first actual motion step (stepNumber >= 1)
  const firstStep = steps.find((s) => s.stepNumber >= 1) || steps[0];
  if (!firstStep) return null;

  const motions = firstStep.motions;
  if (!motions) return null;

  const blueMotion = motions.blue;
  const redMotion = motions.red;

  if (!blueMotion && !redMotion) return null;

  // Build static motions from start angles
  const startMotions = {};

  if (blueMotion) {
    startMotions.blue = {
      color: "blue",
      startLocation: blueMotion.startLocation,
      endLocation: blueMotion.startLocation,
      startOrientation: blueMotion.startOrientation,
      endOrientation: blueMotion.startOrientation,
      motionType: "static",
      rotationDirection: "no_rotation",
      turns: 0,
      isVisible: blueMotion.isVisible !== false,
    };
  }

  if (redMotion) {
    startMotions.red = {
      color: "red",
      startLocation: redMotion.startLocation,
      endLocation: redMotion.startLocation,
      startOrientation: redMotion.startOrientation,
      endOrientation: redMotion.startOrientation,
      motionType: "static",
      rotationDirection: "no_rotation",
      turns: 0,
      isVisible: redMotion.isVisible !== false,
    };
  }

  // Derive grid position from hand positions
  const endPosition = firstStep.startPosition || firstStep.endPosition || null;

  return {
    isStartPosition: true,
    id: `start-${sequenceId}`,
    letter: firstStep.letter || null,
    endPosition,
    motions: startMotions,
  };
}

/**
 * Process a collection of sequence documents.
 * Returns { updated, skipped, noSteps, alreadyHas, fromSource } counts.
 */
async function processCollection(collectionRef, label, resolveSourceRefs = false) {
  const snapshot = await collectionRef.get();
  console.log(`\n📂 ${label}: ${snapshot.size} documents`);

  const stats = { updated: 0, skipped: 0, noSteps: 0, alreadyHas: 0, fromSource: 0 };
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    // Already has startPosition — skip
    if (data.startPosition) {
      stats.alreadyHas++;
      continue;
    }

    // Check for legacy startingPosition
    if (data.startingPosition) {
      stats.alreadyHas++;
      continue;
    }

    // Try steps in this document first
    const steps = data.steps || data.beats;
    let startPosition = null;

    if (steps && steps.length > 0) {
      // Check for step 0 in the array — use it directly if present
      const step0 = steps.find((s) => s.stepNumber === 0);
      if (step0) {
        startPosition = {
          isStartPosition: true,
          id: `start-${docSnap.id}`,
          letter: step0.letter || null,
          endPosition: step0.endPosition || step0.startPosition || null,
          motions: step0.motions,
        };
      } else {
        startPosition = deriveStartPosition(steps, docSnap.id);
      }
    }

    // For compositional-only docs, resolve sourceRef to get startPosition
    // from the user's library (which was already backfilled)
    if (!startPosition && resolveSourceRefs && data.sourceRef) {
      try {
        const sourceDoc = await db.doc(data.sourceRef).get();
        if (sourceDoc.exists) {
          const sourceData = sourceDoc.data();
          if (sourceData.startPosition) {
            startPosition = sourceData.startPosition;
            stats.fromSource++;
          } else {
            // Source also lacks it — try deriving from source steps
            const sourceSteps = sourceData.steps || sourceData.beats;
            if (sourceSteps && sourceSteps.length > 0) {
              startPosition = deriveStartPosition(sourceSteps, docSnap.id);
              if (startPosition) stats.fromSource++;
            }
          }
        }
      } catch (err) {
        // sourceRef might point to a deleted doc — skip silently
      }
    }

    if (!startPosition) {
      stats.noSteps++;
      continue;
    }

    if (isCommit) {
      batch.update(docSnap.ref, { startPosition });
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    stats.updated++;
  }

  if (isCommit && batchCount > 0) {
    await batch.commit();
  }

  return stats;
}

async function main() {
  console.log(`\n🔧 Backfill Start Position ${isCommit ? "(COMMIT MODE)" : "(DRY RUN)"}`);
  if (!isCommit) {
    console.log("   Add --commit to write changes to Firestore\n");
  }

  // 1. Process user library sequences first (they have steps)
  const usersSnapshot = await db.collection("users").get();
  let totalLibStats = { updated: 0, skipped: 0, noSteps: 0, alreadyHas: 0, fromSource: 0 };

  for (const userDoc of usersSnapshot.docs) {
    const libRef = db.collection(`users/${userDoc.id}/sequences`);
    const libSnapshot = await libRef.limit(1).get();
    if (libSnapshot.empty) continue;

    const libStats = await processCollection(libRef, `users/${userDoc.id}/sequences`);
    totalLibStats.updated += libStats.updated;
    totalLibStats.skipped += libStats.skipped;
    totalLibStats.noSteps += libStats.noSteps;
    totalLibStats.alreadyHas += libStats.alreadyHas;
  }

  // 2. Process publicSequences — resolve sourceRef for compositional-only docs
  const publicRef = db.collection("publicSequences");
  const publicStats = await processCollection(publicRef, "publicSequences", true);

  // Summary
  console.log("\n══════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("══════════════════════════════════════");
  console.log(`  User libraries:`);
  console.log(`    Already has startPosition: ${totalLibStats.alreadyHas}`);
  console.log(`    ${isCommit ? "Updated" : "Would update"}:  ${totalLibStats.updated}`);
  console.log(`    No steps / no data:        ${totalLibStats.noSteps}`);
  console.log(`    Skipped (no motion data):  ${totalLibStats.skipped}`);
  console.log(`  publicSequences:`);
  console.log(`    Already has startPosition: ${publicStats.alreadyHas}`);
  console.log(`    ${isCommit ? "Updated" : "Would update"}:  ${publicStats.updated}`);
  console.log(`      (from sourceRef):        ${publicStats.fromSource}`);
  console.log(`    Could not resolve:         ${publicStats.noSteps}`);
  console.log(`    Skipped (no motion data):  ${publicStats.skipped}`);
  console.log("══════════════════════════════════════\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
