#!/usr/bin/env node
/**
 * Fix: Patch static motions that have turns > 0 but rotationDirection = noRotation/empty.
 * Sets rotationDirection to "cw" (matching the orientation calculator's implicit default).
 *
 * Usage:
 *   node scripts/fix-static-rotation.js --dry-run     (preview changes)
 *   node scripts/fix-static-rotation.js --apply        (write to Firestore)
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const dryRun = !process.argv.includes("--apply");

if (dryRun) {
  console.log("=== DRY RUN (pass --apply to write changes) ===\n");
}

const fixes = [];

function checkAndFixSoloProp(soloProp, color) {
  if (!soloProp?.steps) return null;
  let changed = false;
  const fixedSteps = soloProp.steps.map((step, i) => {
    if (!step) return step;

    const isStatic = step.motionType === "static";
    const hasTurns = step.turns && step.turns !== 0 && step.turns !== "fl";
    const noRotation =
      !step.rotationDirection ||
      step.rotationDirection === "noRotation" ||
      step.rotationDirection === "no_rotation" ||
      step.rotationDirection === "";

    if (isStatic && hasTurns && noRotation) {
      changed = true;
      fixes.push({ color, stepIndex: i, turns: step.turns });
      return { ...step, rotationDirection: "cw" };
    }
    return step;
  });

  if (changed) {
    return { ...soloProp, steps: fixedSteps };
  }
  return null;
}

async function fixDocument(docRef, data, source) {
  const updates = {};

  const fixedBlue = checkAndFixSoloProp(data.blueSoloProp, "blue");
  if (fixedBlue) updates.blueSoloProp = fixedBlue;

  const fixedRed = checkAndFixSoloProp(data.redSoloProp, "red");
  if (fixedRed) updates.redSoloProp = fixedRed;

  if (Object.keys(updates).length === 0) return false;

  console.log(`  ${source} ${docRef.id} (word: ${data.word || "?"})`);
  for (const f of fixes) {
    console.log(`    ${f.color} step ${f.stepIndex}: static ${f.turns} turn(s) → rotationDirection: "cw"`);
  }
  fixes.length = 0;

  if (!dryRun) {
    await docRef.update(updates);
    console.log("    ✓ Written to Firestore");
  }
  return true;
}

async function main() {
  let totalFixed = 0;

  // Fix public sequences
  console.log("Scanning publicSequences...");
  const publicSnap = await db.collection("publicSequences").get();
  for (const doc of publicSnap.docs) {
    if (await fixDocument(doc.ref, doc.data(), "public")) totalFixed++;
  }

  // Fix user sequences
  console.log("Scanning user sequences...");
  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const seqSnap = await db
      .collection("users")
      .doc(userDoc.id)
      .collection("sequences")
      .get();

    for (const doc of seqSnap.docs) {
      if (await fixDocument(doc.ref, doc.data(), `user:${userDoc.id}`))
        totalFixed++;
    }
  }

  console.log(`\nDone. ${totalFixed} document(s) ${dryRun ? "would be" : ""} fixed.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
