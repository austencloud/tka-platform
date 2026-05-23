#!/usr/bin/env node
/**
 * Fix Shortcode Embedded Orientation Data
 *
 * Updates shortcode documents that have embedded sequenceData with
 * incorrect orientations. Re-reads the corrected deck sequence data
 * and patches the shortcode's sequenceData and re-encodes the blob.
 *
 * Usage:
 *   node scripts/fix-shortcode-orientations.js --dry-run
 *   node scripts/fix-shortcode-orientations.js
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const SWITCH_MAP = {
  in: "out", out: "in",
  clock: "counter", counter: "clock",
  clockIn: "counterOut", counterOut: "clockIn",
  clockOut: "counterIn", counterIn: "clockOut",
};

function switchOrientation(ori) {
  return SWITCH_MAP[ori] || ori;
}

function calculateEndOrientation(motionType, turns, startOrientation) {
  const type = (motionType || "static").toLowerCase();
  const t = typeof turns === "number" ? turns : 0;
  if (!Number.isInteger(t)) return null;

  const isEvenTurns = t % 2 === 0;
  if (type === "pro" || type === "static") {
    return isEvenTurns ? startOrientation : switchOrientation(startOrientation);
  } else if (type === "anti" || type === "dash") {
    return isEvenTurns ? switchOrientation(startOrientation) : startOrientation;
  }
  return startOrientation;
}

const COLORS = ["blue", "red"];

function fixSteps(steps, startPosition) {
  if (!steps || steps.length === 0) return { steps, changed: false };

  let changed = false;
  const fixedSteps = [];

  let prevEndOri = {};
  if (startPosition) {
    for (const color of COLORS) {
      const m = startPosition.motions?.[color];
      if (m) prevEndOri[color] = m.endOrientation || m.end_orientation;
    }
  }

  for (let i = 0; i < steps.length; i++) {
    const step = JSON.parse(JSON.stringify(steps[i]));
    const motions = step.motions || {};

    for (const color of COLORS) {
      if (!motions[color]) continue;
      const motion = motions[color];

      const expectedStartOri = prevEndOri[color];
      if (expectedStartOri && motion.startOrientation !== expectedStartOri) {
        motion.startOrientation = expectedStartOri;
        changed = true;
      }

      const correctEndOri = calculateEndOrientation(
        motion.motionType, motion.turns, motion.startOrientation
      );
      if (correctEndOri !== null && motion.endOrientation !== correctEndOri) {
        motion.endOrientation = correctEndOri;
        changed = true;
      }

      prevEndOri[color] = motion.endOrientation;
    }

    fixedSteps.push(step);
  }

  return { steps: fixedSteps, changed };
}

async function main() {
  console.log(`=== Shortcode Orientation Fix ${isDryRun ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  // Load ALL shortcode documents
  console.log("Loading shortcodes...");
  const snapshot = await db.collection("shortcodes").get();
  console.log(`Found ${snapshot.size} shortcodes.\n`);

  let fixed = 0;
  let checked = 0;
  let noData = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (!data.sequenceData?.steps || data.sequenceData.steps.length === 0) {
      noData++;
      continue;
    }

    checked++;
    const { steps: fixedSteps, changed } = fixSteps(
      data.sequenceData.steps,
      data.sequenceData.startPosition
    );

    if (changed) {
      fixed++;
      const word = data.sequenceData.word || data.sequence || doc.id;

      if (isDryRun) {
        console.log(`Would fix: ${doc.id} (${word})`);
      } else {
        const updatedSeqData = { ...data.sequenceData, steps: fixedSteps };
        await db.collection("shortcodes").doc(doc.id).update({
          sequenceData: updatedSeqData,
        });
        console.log(`Fixed: ${doc.id} (${word})`);
      }
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Shortcodes checked: ${checked}`);
  console.log(`Shortcodes without sequenceData: ${noData}`);
  console.log(`Shortcodes ${isDryRun ? "would fix" : "fixed"}: ${fixed}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
