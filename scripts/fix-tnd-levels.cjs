/**
 * Fix TnD Sequence Levels in Firestore
 *
 * The TnD base sequences were seeded with level: 1 regardless of actual
 * turn values. This script recomputes the level from step data:
 *   Level 1 = no turns, radial orientations only (in/out)
 *   Level 2 = has turns > 0, radial orientations only
 *   Level 3 = has non-radial orientations (clock/counter)
 *
 * Scans ALL decks with collection === "TnD", reads their sequences,
 * recomputes level, and updates any that are wrong.
 *
 * Usage:
 *   node scripts/fix-tnd-levels.cjs              # Fix all TnD sequences
 *   node scripts/fix-tnd-levels.cjs --dry-run    # Preview without writing
 */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
const DRY_RUN = process.argv.includes("--dry-run");

let db;

try {
  const serviceAccount = require(serviceAccountPath);
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  db = admin.firestore();
} catch (error) {
  console.error("Failed to initialize Firebase:", error.message);
  process.exit(1);
}

// Level computation (mirrors sequence-difficulty-calculator.ts)

function computeLevel(steps) {
  if (!steps || steps.length === 0) return 1;

  let hasNonRadial = false;
  let hasTurns = false;

  for (const step of steps) {
    if (!step.motions) continue;
    const left = step.motions.left;
    const right = step.motions.right;

    for (const motion of [left, right]) {
      if (!motion) continue;

      // Check turns
      if (motion.turns === "fl" || (typeof motion.turns === "number" && motion.turns > 0)) {
        hasTurns = true;
      }

      // Check non-radial orientations
      for (const ori of [motion.startOrientation, motion.endOrientation]) {
        if (ori === "clock" || ori === "counter") {
          hasNonRadial = true;
        }
      }
    }
  }

  if (hasNonRadial) return 3;
  if (hasTurns) return 2;
  return 1;
}

// Main

async function main() {
  console.log("=== Fix TnD Sequence Levels ===\n");

  // Find all TnD decks
  const decksSnapshot = await db.collection("catalogs")
    .where("collection", "==", "TnD")
    .get();

  console.log(`Found ${decksSnapshot.size} TnD decks\n`);

  let totalScanned = 0;
  let totalFixed = 0;
  let totalCorrect = 0;
  let totalNoSteps = 0;
  const levelDistribution = { 1: 0, 2: 0, 3: 0 };

  for (const deckDoc of decksSnapshot.docs) {
    const deckId = deckDoc.id;
    const deckName = deckDoc.data().name || deckId;

    const seqSnapshot = await db.collection(`catalogs/${deckId}/sequences`).get();
    if (seqSnapshot.empty) {
      console.log(`  [${deckId}] No sequences, skipping`);
      continue;
    }

    let deckFixed = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const seqDoc of seqSnapshot.docs) {
      const data = seqDoc.data();
      const steps = data.steps;
      const storedLevel = data.level;

      totalScanned++;

      if (!steps || steps.length === 0) {
        totalNoSteps++;
        continue;
      }

      const computedLevel = computeLevel(steps);
      levelDistribution[computedLevel] = (levelDistribution[computedLevel] || 0) + 1;

      if (storedLevel !== computedLevel) {
        totalFixed++;
        deckFixed++;

        if (!DRY_RUN) {
          batch.update(seqDoc.ref, { level: computedLevel });
          batchCount++;

          if (batchCount >= 490) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      } else {
        totalCorrect++;
      }
    }

    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
    }

    if (deckFixed > 0) {
      console.log(`  [${deckId}] ${deckFixed} of ${seqSnapshot.size} sequences fixed (${deckName})`);
    }
  }

  // Also fix the base TnD motions deck
  const baseDeckId = "l1-tnd-motions";
  const baseSnapshot = await db.collection(`catalogs/${baseDeckId}/sequences`).get();
  if (!baseSnapshot.empty) {
    let batch = db.batch();
    let batchCount = 0;

    for (const seqDoc of baseSnapshot.docs) {
      const data = seqDoc.data();
      const steps = data.steps;
      totalScanned++;

      if (!steps || steps.length === 0) { totalNoSteps++; continue; }

      const computedLevel = computeLevel(steps);
      levelDistribution[computedLevel] = (levelDistribution[computedLevel] || 0) + 1;

      if (data.level !== computedLevel) {
        totalFixed++;
        if (!DRY_RUN) {
          batch.update(seqDoc.ref, { level: computedLevel });
          batchCount++;
        }
        console.log(`  [${baseDeckId}] ${seqDoc.id}: ${data.level} -> ${computedLevel}`);
      } else {
        totalCorrect++;
      }
    }

    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Scanned:   ${totalScanned} sequences`);
  console.log(`Correct:   ${totalCorrect}`);
  console.log(`Fixed:     ${totalFixed}`);
  console.log(`No steps:  ${totalNoSteps}`);
  console.log(`\nLevel distribution:`);
  console.log(`  L1: ${levelDistribution[1] || 0}`);
  console.log(`  L2: ${levelDistribution[2] || 0}`);
  console.log(`  L3: ${levelDistribution[3] || 0}`);

  if (DRY_RUN) {
    console.log("\n--- DRY RUN — no data written ---");
    console.log("Run without --dry-run to apply fixes.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
