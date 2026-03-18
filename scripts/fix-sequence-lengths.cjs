#!/usr/bin/env node
/**
 * Fix Mismatched sequenceLength in Public Sequences
 *
 * Compares the stored sequenceLength in each publicSequences doc against
 * the actual step count in the source user library document. If they
 * differ, updates the public index entry to match reality.
 *
 * Prerequisites:
 *   Ensure serviceAccountKey.json exists in project root
 *
 * Usage:
 *   node scripts/fix-sequence-lengths.cjs           # Dry run (shows mismatches)
 *   node scripts/fix-sequence-lengths.cjs --fix      # Actually fix mismatched entries
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("serviceAccountKey.json not found in project root");
  console.error("Download from Firebase Console > Project Settings > Service Accounts");
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();
const shouldFix = process.argv.includes("--fix");

async function fixSequenceLengths() {
  console.log("Scanning publicSequences for mismatched sequenceLength...\n");

  const publicSnapshot = await db.collection("publicSequences").get();
  console.log(`Found ${publicSnapshot.size} public sequences\n`);

  const mismatches = [];
  const noSource = [];
  const correct = [];

  for (const docSnap of publicSnapshot.docs) {
    const data = docSnap.data();
    const sourceRef = data.sourceRef;
    const storedLength = data.sequenceLength ?? 0;
    const word = data.word || data.name || docSnap.id;

    if (!sourceRef) {
      noSource.push({ id: docSnap.id, word });
      continue;
    }

    // Fetch the source document to get actual step count
    try {
      const sourceDoc = await db.doc(sourceRef).get();
      if (!sourceDoc.exists) {
        noSource.push({ id: docSnap.id, word, reason: "source doc missing" });
        continue;
      }

      const sourceData = sourceDoc.data();

      // Library docs store steps under "steps", "sequenceData.steps",
      // or "stepPairings" / "sequenceData.stepPairings"
      const seqData = sourceData.sequenceData || {};
      const steps = sourceData.steps || seqData.steps;
      const stepPairings = sourceData.stepPairings || seqData.stepPairings;
      const sequenceArray = (Array.isArray(steps) && steps.length > 0)
        ? steps
        : (Array.isArray(stepPairings) ? stepPairings : null);

      if (!sequenceArray || sequenceArray.length === 0) {
        noSource.push({ id: docSnap.id, word, reason: "no steps in source doc" });
        continue;
      }

      const actualStepCount = sequenceArray.length;

      if (storedLength !== actualStepCount) {
        mismatches.push({
          id: docSnap.id,
          word,
          storedLength,
          actualStepCount,
          sourceRef,
        });
      } else {
        correct.push({ id: docSnap.id, word, length: storedLength });
      }
    } catch (err) {
      noSource.push({ id: docSnap.id, word, reason: err.message });
    }
  }

  // Report
  console.log(`Correct: ${correct.length}`);
  console.log(`Mismatched: ${mismatches.length}`);
  console.log(`No source/error: ${noSource.length}\n`);

  if (mismatches.length > 0) {
    console.log("MISMATCHES:");
    for (const m of mismatches) {
      console.log(`  ${m.word} (${m.id}): stored=${m.storedLength}, actual=${m.actualStepCount}`);
    }
    console.log();
  }

  if (noSource.length > 0) {
    console.log("SKIPPED (no source):");
    for (const n of noSource) {
      console.log(`  ${n.word} (${n.id}): ${n.reason || "no sourceRef"}`);
    }
    console.log();
  }

  // Fix if requested
  if (shouldFix && mismatches.length > 0) {
    console.log(`Fixing ${mismatches.length} mismatched entries...\n`);

    const batch = db.batch();
    for (const m of mismatches) {
      const ref = db.collection("publicSequences").doc(m.id);
      batch.update(ref, { sequenceLength: m.actualStepCount });
    }

    await batch.commit();
    console.log(`Fixed ${mismatches.length} entries.`);
  } else if (!shouldFix && mismatches.length > 0) {
    console.log("Dry run complete. Run with --fix to apply changes.");
  } else {
    console.log("All sequence lengths are correct.");
  }
}

fixSequenceLengths().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
