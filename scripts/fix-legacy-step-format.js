/**
 * Fix Legacy Step Format Script
 *
 * Finds and fixes sequences with legacy step format where motion data is at the
 * top level (blue/red) instead of inside a 'motions' object.
 *
 * Legacy format:
 *   { beat: 0, letter: "X", blue: { type, dir, start, end, ... }, red: { ... } }
 *
 * Modern format:
 *   { stepNumber: 1, letter: "X", motions: { blue: { motionType, rotationDirection, ... }, red: { ... } } }
 *
 * Usage:
 *   node scripts/fix-legacy-step-format.js                    # Preview all legacy sequences
 *   node scripts/fix-legacy-step-format.js --word "Θ-X-Ω-W-"  # Find specific sequence
 *   node scripts/fix-legacy-step-format.js --confirm          # Apply fixes
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

/**
 * Check if a step has legacy format (blue/red at top level instead of in motions)
 */
function hasLegacyFormat(step) {
  if (!step) return false;

  // Modern format has motions.blue or motions.red with motionType
  const hasModernFormat =
    step.motions && (step.motions.blue?.motionType || step.motions.red?.motionType);

  if (hasModernFormat) return false;

  // Legacy format 1: blue/red at top level with type/dir/start/end fields
  const hasLegacyBlue = step.blue && (step.blue.type || step.blue.dir || step.blue.motionType);
  const hasLegacyRed = step.red && (step.red.type || step.red.dir || step.red.motionType);

  // Legacy format 2: motions exists but with wrong internal structure
  const hasLegacyMotionsBlue = step.motions?.blue && (step.motions.blue.type || step.motions.blue.dir);
  const hasLegacyMotionsRed = step.motions?.red && (step.motions.red.type || step.motions.red.dir);

  return hasLegacyBlue || hasLegacyRed || hasLegacyMotionsBlue || hasLegacyMotionsRed;
}

/**
 * Convert a single step from legacy to modern format
 */
function convertStep(step, index) {
  const motions = {};

  if (step.blue) {
    motions.blue = {
      motionType: step.blue.type,
      rotationDirection: step.blue.dir,
      startLocation: step.blue.start,
      endLocation: step.blue.end,
      turns: step.blue.turns,
      startOrientation: step.blue.startOri,
      endOrientation: step.blue.endOri,
      propType: step.blue.propType,
    };
    // Remove undefined values
    Object.keys(motions.blue).forEach((key) => {
      if (motions.blue[key] === undefined) delete motions.blue[key];
    });
  }

  if (step.red) {
    motions.red = {
      motionType: step.red.type,
      rotationDirection: step.red.dir,
      startLocation: step.red.start,
      endLocation: step.red.end,
      turns: step.red.turns,
      startOrientation: step.red.startOri,
      endOrientation: step.red.endOri,
      propType: step.red.propType,
    };
    // Remove undefined values
    Object.keys(motions.red).forEach((key) => {
      if (motions.red[key] === undefined) delete motions.red[key];
    });
  }

  // Create modern step format
  const modernStep = {
    id: step.id || crypto.randomUUID(),
    stepNumber: step.stepNumber ?? step.beat + 1 ?? index + 1, // beat 0 -> stepNumber 1
    letter: step.letter,
    duration: step.duration ?? 1,
    blueReversal: step.blueReversal ?? false,
    redReversal: step.redReversal ?? false,
    isBlank: step.isBlank ?? false,
    motions,
  };

  // Preserve startPosition/endPosition if they exist
  if (step.start || step.startPosition) {
    modernStep.startPosition = step.start || step.startPosition;
  }
  if (step.end || step.endPosition) {
    modernStep.endPosition = step.end || step.endPosition;
  }

  return modernStep;
}

/**
 * Check if a sequence document has legacy step format
 */
function sequenceHasLegacySteps(data) {
  const steps = data.steps || data.beats || [];
  return steps.some(hasLegacyFormat);
}

/**
 * Convert all steps in a sequence to modern format
 */
function convertSequenceSteps(data) {
  const oldSteps = data.steps || data.beats || [];
  const newSteps = oldSteps.map((step, index) => {
    if (hasLegacyFormat(step)) {
      return convertStep(step, index);
    }
    return step;
  });

  return {
    ...data,
    steps: newSteps,
    // Remove old 'beats' field if it existed
    beats: admin.firestore.FieldValue.delete(),
  };
}

async function findAndFixLegacySequences(options = {}) {
  const { wordFilter, confirm } = options;

  console.log("\n=".repeat(60));
  console.log("Fix Legacy Step Format Script");
  console.log("=".repeat(60));
  console.log();

  // Collections to check
  const collections = ["publicSequences"];

  // Also check user library subcollections
  const usersSnapshot = await db.collection("users").get();
  for (const userDoc of usersSnapshot.docs) {
    collections.push(`users/${userDoc.id}/library`);
  }

  console.log(`Checking ${collections.length} collections...`);
  console.log();

  let totalFound = 0;
  let totalFixed = 0;
  const foundSequences = [];

  for (const collectionPath of collections) {
    try {
      const collRef = db.collection(collectionPath);
      const snapshot = await collRef.get();

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Filter by word if specified
        if (wordFilter && !data.word?.includes(wordFilter)) {
          continue;
        }

        // Check if this sequence has legacy steps
        if (sequenceHasLegacySteps(data)) {
          totalFound++;
          const steps = data.steps || data.beats || [];
          const legacyCount = steps.filter(hasLegacyFormat).length;

          foundSequences.push({
            path: `${collectionPath}/${doc.id}`,
            word: data.word,
            stepCount: steps.length,
            legacyCount,
            docRef: doc.ref,
            data,
          });

          console.log(`Found: ${collectionPath}/${doc.id}`);
          console.log(
            `  Word: ${data.word} | Steps: ${steps.length} | Legacy: ${legacyCount}`
          );

          // Show sample of legacy data
          const legacyStep = steps.find(hasLegacyFormat);
          if (legacyStep) {
            console.log(`  Sample legacy step:`);
            console.log(`    beat: ${legacyStep.beat}, letter: ${legacyStep.letter}`);
            if (legacyStep.blue) {
              console.log(
                `    blue: type=${legacyStep.blue.type}, dir=${legacyStep.blue.dir}`
              );
            }
            if (legacyStep.red) {
              console.log(
                `    red: type=${legacyStep.red.type}, dir=${legacyStep.red.dir}`
              );
            }
          }
          console.log();
        }
      }
    } catch (error) {
      console.error(`Error checking ${collectionPath}:`, error.message);
    }
  }

  console.log("-".repeat(60));
  console.log(`Total sequences with legacy format: ${totalFound}`);
  console.log();

  if (totalFound === 0) {
    console.log("No sequences need fixing!");
    return;
  }

  if (!confirm) {
    console.log("Preview mode - no changes made.");
    console.log("Run with --confirm to apply fixes.");
    return;
  }

  // Apply fixes
  console.log("Applying fixes...");
  console.log();

  for (const seq of foundSequences) {
    try {
      const convertedData = convertSequenceSteps(seq.data);
      await seq.docRef.update({
        steps: convertedData.steps,
      });
      totalFixed++;
      console.log(`✅ Fixed: ${seq.path} (${seq.word})`);
    } catch (error) {
      console.error(`❌ Failed to fix ${seq.path}:`, error.message);
    }
  }

  console.log();
  console.log("-".repeat(60));
  console.log(`Fixed ${totalFixed}/${totalFound} sequences.`);
}

// Parse command line args
const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const wordIndex = args.indexOf("--word");
const wordFilter = wordIndex !== -1 ? args[wordIndex + 1] : null;

findAndFixLegacySequences({ wordFilter, confirm })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
