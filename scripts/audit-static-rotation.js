#!/usr/bin/env node
/**
 * Audit: Find static motions with turns > 0 but rotationDirection = noRotation
 *
 * This is invalid data — a static motion with turns must have CW or CCW rotation.
 * The missing rotation causes arrow placement to use the wrong directional tuple,
 * placing arrows below/above props instead of beside them.
 *
 * Scans both public sequences and all user library sequences.
 *
 * Usage:
 *   node scripts/audit-static-rotation.js
 *   node scripts/audit-static-rotation.js --public-only
 *   node scripts/audit-static-rotation.js --user <userId>
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

const args = process.argv.slice(2);
const publicOnly = args.includes("--public-only");
const userFlag = args.indexOf("--user");
const specificUser = userFlag >= 0 ? args[userFlag + 1] : null;

// Track all flagged sequences
const flagged = [];

function checkSoloProp(soloProp, color, seqId, seqWord, source) {
  if (!soloProp?.steps) return;

  for (let i = 0; i < soloProp.steps.length; i++) {
    const step = soloProp.steps[i];
    if (!step) continue;

    const isStatic = step.motionType === "static";
    const hasTurns = step.turns && step.turns !== 0 && step.turns !== "fl";
    const noRotation =
      !step.rotationDirection ||
      step.rotationDirection === "noRotation" ||
      step.rotationDirection === "no_rotation" ||
      step.rotationDirection === "";

    if (isStatic && hasTurns && noRotation) {
      flagged.push({
        source,
        seqId,
        word: seqWord || "(no word)",
        color,
        stepIndex: i,
        turns: step.turns,
        rotationDirection: step.rotationDirection || "(empty)",
        startLocation: step.startLocation,
        endLocation: step.endLocation,
        startOrientation: step.startOrientation,
        endOrientation: step.endOrientation,
      });
    }
  }
}

function checkSequence(doc, source) {
  const data = doc.data();
  const seqId = doc.id;
  const word = data.word || data.name || "";

  // Check blue solo prop
  if (data.leftSoloProp) {
    checkSoloProp(data.leftSoloProp, "blue", seqId, word, source);
  }

  // Check red solo prop
  if (data.rightSoloProp) {
    checkSoloProp(data.rightSoloProp, "red", seqId, word, source);
  }
}

async function scanPublicSequences() {
  console.log("Scanning publicSequences...");
  const snapshot = await db.collection("publicSequences").get();
  console.log(`  Found ${snapshot.size} public sequences`);

  snapshot.forEach((doc) => checkSequence(doc, "public"));
}

async function scanUserSequences(userId) {
  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("sequences")
    .get();

  snapshot.forEach((doc) => checkSequence(doc, `user:${userId}`));
  return snapshot.size;
}

async function scanAllUsers() {
  console.log("Scanning all user sequences...");
  const usersSnapshot = await db.collection("users").get();
  console.log(`  Found ${usersSnapshot.size} users`);

  let totalSeqs = 0;
  let userCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const count = await scanUserSequences(userDoc.id);
    totalSeqs += count;
    userCount++;

    if (userCount % 50 === 0) {
      console.log(
        `  Scanned ${userCount}/${usersSnapshot.size} users (${totalSeqs} sequences so far)`
      );
    }
  }

  console.log(
    `  Scanned ${userCount} users, ${totalSeqs} total user sequences`
  );
}

async function main() {
  console.log("=== Static Motion Rotation Audit ===\n");
  console.log(
    "Looking for: static motions with turns > 0 and rotationDirection = noRotation\n"
  );

  // Always scan public
  await scanPublicSequences();

  // Scan user sequences unless --public-only
  if (!publicOnly) {
    if (specificUser) {
      console.log(`\nScanning user: ${specificUser}`);
      const count = await scanUserSequences(specificUser);
      console.log(`  Found ${count} sequences for this user`);
    } else {
      await scanAllUsers();
    }
  }

  // Report
  console.log("\n=== RESULTS ===\n");

  if (flagged.length === 0) {
    console.log("No invalid static motions found.");
  } else {
    console.log(`Found ${flagged.length} invalid static motion(s):\n`);

    for (const f of flagged) {
      console.log(`  Source: ${f.source}`);
      console.log(`  Sequence: ${f.seqId} (word: ${f.word})`);
      console.log(`  ${f.color} step ${f.stepIndex}: static with ${f.turns} turn(s)`);
      console.log(`  rotationDirection: ${f.rotationDirection}`);
      console.log(`  location: ${f.startLocation} → ${f.endLocation}`);
      console.log(`  orientation: ${f.startOrientation} → ${f.endOrientation}`);
      console.log("");
    }

    // Summary table
    console.log("--- Summary ---");
    const bySource = {};
    for (const f of flagged) {
      const key = f.source.startsWith("user:") ? "user libraries" : "public";
      bySource[key] = (bySource[key] || 0) + 1;
    }
    for (const [source, count] of Object.entries(bySource)) {
      console.log(`  ${source}: ${count} invalid motion(s)`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
