/**
 * Backfill loopType and isCircular from publicSequences to user source documents.
 *
 * The original backfill only wrote to publicSequences. User documents
 * (users/{uid}/sequences/{id}) were never updated, so My Library and
 * the sequence viewer never show loop icons.
 *
 * Usage:
 *   node scripts/backfill-user-loop-types.cjs           # Dry run
 *   node scripts/backfill-user-loop-types.cjs --commit   # Write to Firestore
 */

const admin = require("firebase-admin");
const path = require("path");

const sa = require(path.join(__dirname, "../serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const COMMIT = process.argv.includes("--commit");

async function backfill() {
  console.log(COMMIT ? "=== COMMIT MODE ===" : "=== DRY RUN (use --commit to write) ===");
  console.log();

  const pubSnap = await db.collection("publicSequences").get();
  let total = 0;
  let skipped = 0;
  let updated = 0;
  let missing = 0;
  let errors = 0;

  const batch = db.batch();
  let batchCount = 0;

  for (const pubDoc of pubSnap.docs) {
    const pubData = pubDoc.data();
    const { loopType, isCircular, sourceRef, word } = pubData;

    // Skip if public doc doesn't have loopType
    if (!loopType) {
      skipped++;
      continue;
    }

    if (!sourceRef) {
      skipped++;
      continue;
    }

    total++;

    try {
      const userDocRef = db.doc(sourceRef);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        console.log(`  MISSING: ${word} → ${sourceRef}`);
        missing++;
        continue;
      }

      const userData = userDoc.data();

      // Skip if user doc already has loopType
      if (userData.loopType) {
        skipped++;
        continue;
      }

      const updateData = { loopType };
      if (isCircular !== undefined) {
        updateData.isCircular = isCircular;
      }

      console.log(`  UPDATE: ${word} → loopType=${loopType}, isCircular=${isCircular}`);

      if (COMMIT) {
        batch.update(userDocRef, updateData);
        batchCount++;

        // Firestore batches max at 500
        if (batchCount >= 450) {
          await batch.commit();
          console.log(`  (committed batch of ${batchCount})`);
          batchCount = 0;
        }
      }

      updated++;
    } catch (err) {
      console.error(`  ERROR: ${word} → ${err.message}`);
      errors++;
    }
  }

  // Commit remaining
  if (COMMIT && batchCount > 0) {
    await batch.commit();
    console.log(`  (committed final batch of ${batchCount})`);
  }

  console.log();
  console.log("=== SUMMARY ===");
  console.log(`  Public sequences with loopType: ${total}`);
  console.log(`  User docs updated: ${updated}`);
  console.log(`  Skipped (already has loopType or no public loopType): ${skipped}`);
  console.log(`  Source doc missing: ${missing}`);
  console.log(`  Errors: ${errors}`);

  if (!COMMIT && updated > 0) {
    console.log();
    console.log(`Run with --commit to apply ${updated} updates.`);
  }
}

backfill().then(() => process.exit(0));
