/**
 * Backfill LOOP Types Script
 *
 * Updates existing publicSequences documents with loopType from the loop-labels collection.
 * This is a one-time migration to sync LOOP labeler data into the public index.
 *
 * Usage:
 *   node scripts/backfill-loop-types.cjs           # Dry run (preview changes)
 *   node scripts/backfill-loop-types.cjs --commit  # Actually write to Firestore
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

const LOOP_LABELS_COLLECTION = "loop-labels";
const PUBLIC_SEQUENCES_COLLECTION = "publicSequences";

/**
 * Derive loopType string from a LOOP label document
 */
function deriveLoopType(labelData) {
  if (!labelData) return null;

  // If explicitly marked as freeform
  if (labelData.isFreeform) {
    return "freeform";
  }

  // If has designations, join the components
  const designations = labelData.designations;
  if (designations && designations.length > 0) {
    // Take the first designation's components and join them
    const components = designations[0].components;
    if (components && components.length > 0) {
      return components.join("+");
    }
    // Or use the loopType directly if no components
    return designations[0].loopType || "freeform";
  }

  return null;
}

async function backfillLoopTypes(commit = false) {
  console.log("\n=== LOOP Type Backfill ===\n");
  console.log(`Mode: ${commit ? "COMMIT (will write to Firestore)" : "DRY RUN (preview only)"}\n`);

  // Step 1: Load all LOOP labels
  console.log("Loading LOOP labels...");
  const labelsSnapshot = await db.collection(LOOP_LABELS_COLLECTION).get();
  const labelsByWord = new Map();

  labelsSnapshot.forEach((doc) => {
    const word = doc.id;
    const loopType = deriveLoopType(doc.data());
    if (loopType) {
      labelsByWord.set(word.toUpperCase(), loopType);
    }
  });

  console.log(`Found ${labelsByWord.size} LOOP labels\n`);

  // Step 2: Load all public sequences
  console.log("Loading public sequences...");
  const publicSnapshot = await db.collection(PUBLIC_SEQUENCES_COLLECTION).get();
  console.log(`Found ${publicSnapshot.size} public sequences\n`);

  // Step 3: Match and prepare updates
  const updates = [];
  const noMatch = [];
  const alreadySet = [];

  publicSnapshot.forEach((doc) => {
    const data = doc.data();
    const word = (data.word || "").toUpperCase();
    const existingLoopType = data.loopType;

    // Check if there's a LOOP label for this word
    const loopType = labelsByWord.get(word);

    if (loopType) {
      if (existingLoopType === loopType) {
        alreadySet.push({ id: doc.id, word: data.word, loopType });
      } else {
        updates.push({
          id: doc.id,
          word: data.word,
          loopType,
          previousLoopType: existingLoopType || null,
        });
      }
    } else {
      noMatch.push({ id: doc.id, word: data.word });
    }
  });

  // Step 4: Report
  console.log("=== Summary ===\n");
  console.log(`Total public sequences: ${publicSnapshot.size}`);
  console.log(`Already have correct loopType: ${alreadySet.length}`);
  console.log(`To update: ${updates.length}`);
  console.log(`No LOOP label found: ${noMatch.length}\n`);

  if (updates.length > 0) {
    console.log("=== Updates to apply ===\n");
    updates.forEach((u) => {
      console.log(`  ${u.word}: ${u.previousLoopType || "(none)"} -> ${u.loopType}`);
    });
    console.log();
  }

  // Step 5: Apply updates if committing
  if (commit && updates.length > 0) {
    console.log("Applying updates...\n");

    const batch = db.batch();
    let batchCount = 0;

    for (const update of updates) {
      const docRef = db.collection(PUBLIC_SEQUENCES_COLLECTION).doc(update.id);
      batch.update(docRef, {
        loopType: update.loopType,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchCount++;

      // Firestore batches are limited to 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  Committed batch of ${batchCount} updates`);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`  Committed final batch of ${batchCount} updates`);
    }

    console.log(`\nDone! Updated ${updates.length} sequences.\n`);
  } else if (!commit && updates.length > 0) {
    console.log("Run with --commit to apply these changes.\n");
  } else {
    console.log("No updates needed.\n");
  }

  // Show some stats about LOOP types
  const loopTypeStats = new Map();
  updates.forEach((u) => {
    const count = loopTypeStats.get(u.loopType) || 0;
    loopTypeStats.set(u.loopType, count + 1);
  });
  alreadySet.forEach((u) => {
    const count = loopTypeStats.get(u.loopType) || 0;
    loopTypeStats.set(u.loopType, count + 1);
  });

  if (loopTypeStats.size > 0) {
    console.log("=== LOOP Type Distribution ===\n");
    const sorted = Array.from(loopTypeStats.entries()).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    console.log();
  }
}

// Parse args and run
const commit = process.argv.includes("--commit");
backfillLoopTypes(commit)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
