#!/usr/bin/env node
/**
 * Backfill encoderHash for existing publicSequences documents.
 *
 * publicSequences docs don't store steps — they store thumbnails, metrics,
 * and metadata. The encoder needs full motion data per step, so this script
 * fetches from sourceRef (the user's library doc) to get the steps.
 *
 * Usage: node scripts/backfill-encoder-hash.cjs [--dry-run] [--limit N]
 */

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

// --- Minimal SequenceEncoder port (encode only) ---
// Standalone port of the encoding logic from
// src/lib/shared/navigation/services/implementations/SequenceEncoder.ts
// so the script can run without bundling the full app.

// Keys must match the actual enum STRING VALUES stored in Firestore,
// not the enum member names. E.g., GridLocation.NORTH = "n", not "north".
const LOCATION_ENCODE = {
  n: "no", e: "ea", s: "so", w: "we",
  ne: "ne", se: "se", sw: "sw", nw: "nw",
  c: "c",
};

const ORIENTATION_ENCODE = {
  in: "i", out: "o", clock: "k", counter: "t",
  clockIn: "I", clockOut: "O", counterIn: "N", counterOut: "U",
  centerN: "1", centerNE: "2", centerE: "3", centerSE: "4",
  centerS: "5", centerSW: "6", centerW: "7", centerNW: "8",
};

const ROTATION_ENCODE = {
  cw: "c", ccw: "u", noRotation: "x",
};

const MOTION_TYPE_ENCODE = {
  pro: "p", anti: "a", float: "l", dash: "d", static: "s",
};

// Keys match PropType enum string values (e.g., PropType.SIMPLESTAFF = "simple_staff")
const PROP_TYPE_ENCODE = {
  staff: "S", simple_staff: "s", bigstaff: "1", staff_v2: "2",
  club: "C", bigclub: "c", fan: "F", bigfan: "f",
  triad: "T", bigtriad: "t", minihoop: "M", bighoop: "H",
  buugeng: "B", bigbuugeng: "b", fractalgeng: "R", trigeng: "J",
  hand: "X", triquetra: "Q", triquetra2: "q", sword: "W",
  chicken: "K", bigchicken: "k", guitar: "G", ukulele: "u",
  doublestar: "D", bigdoublestar: "d", eightrings: "E", bigeightrings: "e",
  contactball: "A", bigcontactball: "a", doublecontactball: "V",
  bigdoublecontactball: "v", quiad: "I", torch: "O", bigtorch: "L", poi: "P",
};

function encodeMotion(m) {
  if (!m) return "";
  const sl = LOCATION_ENCODE[m.startLocation];
  const el = LOCATION_ENCODE[m.endLocation];
  const so = ORIENTATION_ENCODE[m.startOrientation];
  const eo = ORIENTATION_ENCODE[m.endOrientation];
  const rd = ROTATION_ENCODE[m.rotationDirection];
  const t = m.turns === "fl" ? "f" : String(m.turns);
  const mt = MOTION_TYPE_ENCODE[m.motionType];
  const pt = PROP_TYPE_ENCODE[m.propType];
  if (!sl || !el || !so || !eo || !rd || !mt || !pt) return "";
  return `${sl}${el}${so}${eo}${rd}${t}${mt}${pt}`;
}

function encodeBeat(beat) {
  const motions = beat.motions || { blue: undefined, red: undefined };
  return `${encodeMotion(motions.blue)}:${encodeMotion(motions.red)}`;
}

function encodeSequence(seq) {
  const sp = seq.startPosition || seq.startingPosition;
  const startEnc = sp ? encodeBeat(sp) : ":";
  const steps = seq.steps || [];
  // Source docs may use beatNumber or stepNumber — filter out beat 0 (start position)
  const stepEncs = steps
    .filter((s) => (s.stepNumber ?? s.beatNumber) !== 0)
    .map((s) => encodeBeat(s));
  return `${startEnc}|${stepEncs.join("|")}`;
}

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const batchLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

  // Initialize Firebase Admin
  // Uses GOOGLE_APPLICATION_CREDENTIALS env var or default service account
  initializeApp();
  const db = getFirestore();

  const publicSeqRef = db.collection("publicSequences");
  const snapshot = await publicSeqRef.get();

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let updated = 0;

  for (const pubDoc of snapshot.docs) {
    if (updated >= batchLimit) break;

    const pubData = pubDoc.data();

    // Skip if already has encoderHash
    if (pubData.encoderHash) {
      skipped++;
      continue;
    }

    processed++;

    // Fetch source library doc (has full steps)
    const sourceRef = pubData.sourceRef;
    if (!sourceRef) {
      console.warn(`[SKIP] ${pubDoc.id}: no sourceRef`);
      failed++;
      continue;
    }

    try {
      const sourceDoc = await db.doc(sourceRef).get();
      if (!sourceDoc.exists) {
        console.warn(`[SKIP] ${pubDoc.id}: sourceRef ${sourceRef} not found`);
        failed++;
        continue;
      }

      const sourceData = sourceDoc.data();
      if (!sourceData.steps || sourceData.steps.length === 0) {
        console.warn(`[SKIP] ${pubDoc.id}: no steps in source`);
        failed++;
        continue;
      }

      const pipeString = encodeSequence(sourceData);
      const hash = sha256(pipeString);

      if (dryRun) {
        console.log(`[DRY] ${pubDoc.id} (${pubData.word}): ${hash.slice(0, 12)}...`);
      } else {
        await pubDoc.ref.update({ encoderHash: hash });
        console.log(`[OK]  ${pubDoc.id} (${pubData.word}): ${hash.slice(0, 12)}...`);
      }
      updated++;
    } catch (err) {
      console.error(`[ERR] ${pubDoc.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Processed: ${processed}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  if (dryRun) console.log("(dry run — no writes made)");
}

main().catch(console.error);
