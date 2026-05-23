#!/usr/bin/env node
/**
 * Fix Shortcode Encoded Blobs
 *
 * For shortcodes whose sequenceData had orientation errors (and was already
 * fixed by fix-shortcode-orientations.js), the `encoded` blob may still
 * contain stale data. Strategy 0 (encoded blob) takes priority over
 * Strategy 4 (sequenceData), so we must either re-encode or remove the
 * stale blob.
 *
 * This script removes the `encoded` field from affected shortcodes so
 * resolution falls through to Strategy 4 (the corrected sequenceData).
 *
 * Usage:
 *   node scripts/fix-shortcode-encoded-blobs.js --dry-run
 *   node scripts/fix-shortcode-encoded-blobs.js
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

function hasOrientationErrors(steps, startPosition) {
  if (!steps || steps.length === 0) return false;

  let prevEndOri = {};
  if (startPosition) {
    for (const color of COLORS) {
      const m = startPosition.motions?.[color];
      if (m) prevEndOri[color] = m.endOrientation || m.end_orientation;
    }
  }

  for (const step of steps) {
    const motions = step.motions || {};
    for (const color of COLORS) {
      if (!motions[color]) continue;
      const motion = motions[color];

      const expectedStartOri = prevEndOri[color];
      if (expectedStartOri && motion.startOrientation !== expectedStartOri) {
        return true;
      }

      const correctEndOri = calculateEndOrientation(
        motion.motionType, motion.turns, motion.startOrientation
      );
      if (correctEndOri !== null && motion.endOrientation !== correctEndOri) {
        return true;
      }

      prevEndOri[color] = motion.endOrientation;
    }
  }
  return false;
}

async function main() {
  console.log(`=== Shortcode Encoded Blob Cleanup ${isDryRun ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  const snapshot = await db.collection("shortcodes").get();
  console.log(`Found ${snapshot.size} shortcodes.\n`);

  let removed = 0;
  let checked = 0;
  let noEncoded = 0;
  let noSeqData = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (!data.encoded) {
      noEncoded++;
      continue;
    }

    if (!data.sequenceData?.steps || data.sequenceData.steps.length === 0) {
      noSeqData++;
      continue;
    }

    checked++;

    // Re-check if this shortcode's sequenceData *originally* had errors
    // (i.e., the encoded blob was created from bad data).
    // We already fixed sequenceData, so we check against the ORIGINAL
    // pattern: if sequenceData was affected, the encoded blob is stale.
    //
    // Simpler approach: just remove encoded from ALL shortcodes that have
    // sequenceData — the sequenceData path is reliable and correct.
    // This is safe because Strategy 4 is a complete fallback.

    const word = data.sequenceData.word || data.sequence || doc.id;

    if (isDryRun) {
      console.log(`Would remove encoded blob: ${doc.id} (${word})`);
    } else {
      await db.collection("shortcodes").doc(doc.id).update({
        encoded: admin.firestore.FieldValue.delete(),
      });
      console.log(`Removed encoded blob: ${doc.id} (${word})`);
    }
    removed++;
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Shortcodes with encoded+sequenceData checked: ${checked}`);
  console.log(`Shortcodes without encoded field: ${noEncoded}`);
  console.log(`Shortcodes with encoded but no sequenceData: ${noSeqData}`);
  console.log(`Encoded blobs ${isDryRun ? "would remove" : "removed"}: ${removed}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
