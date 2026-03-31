/**
 * Backfill Deck SliceType
 *
 * Adds sliceType field to existing deck documents in Firestore by parsing the
 * deck ID. Only adds the field where it's missing and inferable.
 *
 * Inference rules:
 *   sliceType — from deck ID:
 *     ID contains "-halved-"    -> "halved"
 *     ID contains "-quartered-" -> "quartered"
 *     Otherwise                 -> skipped (not all decks have a slice type)
 *
 * Usage:
 *   node scripts/backfill-deck-slicetype.cjs --dry-run  # preview changes
 *   node scripts/backfill-deck-slicetype.cjs             # apply changes
 */

const admin = require("firebase-admin");
const path = require("path");

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");
const DECKS_COLLECTION = "decks";

// ============================================================================
// Firebase Initialization
// ============================================================================

let db;

try {
  const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
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

// ============================================================================
// Inference
// ============================================================================

/**
 * Infer sliceType from deck ID by checking for "-halved-" or "-quartered-".
 *
 * @param {string} deckId - The deck document ID
 * @returns {'halved' | 'quartered' | null}
 */
function inferSliceType(deckId) {
  if (deckId.includes("-halved-")) return "halved";
  if (deckId.includes("-quartered-")) return "quartered";
  return null;
}

// ============================================================================
// Main Execution
// ============================================================================

async function backfillSliceType() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Backfill Deck SliceType ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    const snapshot = await db.collection(DECKS_COLLECTION).get();

    if (snapshot.empty) {
      console.log("No deck documents found in Firestore.\n");
      return;
    }

    console.log(`Found ${snapshot.size} deck(s).\n`);

    const changes = [];
    let skippedExisting = 0;
    let skippedNoMatch = 0;

    for (const doc of snapshot.docs) {
      const deckId = doc.id;
      const currentData = doc.data();

      // Skip decks that already have sliceType set
      if (currentData.sliceType !== undefined) {
        skippedExisting++;
        continue;
      }

      const inferred = inferSliceType(deckId);

      if (inferred === null) {
        skippedNoMatch++;
        continue;
      }

      changes.push({
        id: deckId,
        name: currentData.name || "(no name)",
        sliceType: inferred,
      });
    }

    // Display what will change
    if (changes.length === 0) {
      console.log("No changes needed.");
      console.log(`  Already set: ${skippedExisting}`);
      console.log(`  No slice in ID: ${skippedNoMatch}\n`);
      return;
    }

    console.log(`Changes needed for ${changes.length} deck(s):\n`);

    for (const change of changes) {
      console.log(`  ${change.id}  ->  sliceType: "${change.sliceType}"`);
    }

    console.log();

    // Apply via batch writes (max 500 per batch, Firestore limit)
    if (!DRY_RUN) {
      console.log("Applying changes...\n");

      const BATCH_SIZE = 500;
      for (let i = 0; i < changes.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const slice = changes.slice(i, i + BATCH_SIZE);

        for (const change of slice) {
          const ref = db.collection(DECKS_COLLECTION).doc(change.id);
          batch.update(ref, { sliceType: change.sliceType });
        }

        await batch.commit();
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: updated ${slice.length} deck(s)`);
      }

      console.log();
    }

    // Summary
    console.log(`${"=".repeat(80)}`);
    console.log(`Summary:`);
    console.log(`  Total decks:        ${snapshot.size}`);
    console.log(`  Updated:            ${changes.length}`);
    console.log(`  Skipped (existing): ${skippedExisting}`);
    console.log(`  Skipped (no match): ${skippedNoMatch}`);
    console.log(`  Status:             ${DRY_RUN ? "DRY RUN - no changes applied" : "Changes applied"}`);
    console.log(`${"=".repeat(80)}\n`);

  } catch (error) {
    console.error("Error during backfill:", error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

backfillSliceType();
