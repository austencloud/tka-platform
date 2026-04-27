/**
 * Backfill Period Field for Public Sequences
 *
 * Adds/corrects the `period` field on publicSequences documents.
 * For rotated LOOPs, fetches the source sequence to determine if
 * the period is 2 (halved/180°) or 4 (quartered/90°).
 *
 * Detection strategy (per document):
 *   1. If `period` is already set and > 1, skip (already migrated correctly)
 *   2. If loopType doesn't contain "rotated", period = 2 (non-rotated LOOPs
 *      are always halved; non-LOOPs get period = 1)
 *   3. Fetch source sequence via sourceRef
 *   4. If source has orientationCycleCount = 4, period = 4
 *   5. Otherwise, check startPosition at quarter intervals against the
 *      quarter-rotation position map
 *   6. Default to 2 if no evidence of quartered
 *
 * Usage:
 *   node scripts/backfill-period.cjs           # Dry run
 *   node scripts/backfill-period.cjs --commit  # Write to Firestore
 */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const PUBLIC_SEQUENCES = "publicSequences";

// Quarter rotation CW map — position N maps to position N+2 (mod 8 within group)
// Only need alpha/beta/gamma for the check — those cover ~95% of sequences
const QUARTER_CW = buildQuarterMap();

function buildQuarterMap() {
  const map = {};
  for (const prefix of ["alpha", "beta", "gamma", "zeta", "eta", "tau"]) {
    for (let i = 1; i <= 8; i++) {
      const next = ((i - 1 + 2) % 8) + 1;
      map[`${prefix}${i}`] = `${prefix}${next}`;
    }
    // gamma/zeta/eta/tau 9-16 group
    if (prefix !== "alpha" && prefix !== "beta") {
      for (let i = 9; i <= 16; i++) {
        const next = ((i - 9 + 2) % 8) + 9;
        map[`${prefix}${i}`] = `${prefix}${next}`;
      }
    }
  }
  return map;
}

// CCW is the reverse of CW
const QUARTER_CCW = {};
for (const [from, to] of Object.entries(QUARTER_CW)) {
  QUARTER_CCW[to] = from;
}

function isRotatedLoopType(loopType) {
  if (!loopType) return false;
  const lower = String(loopType).toLowerCase();
  return lower.includes("rotated");
}

/**
 * Detect period from source sequence steps using position maps.
 * Returns 4 if quarter-rotation detected, 2 otherwise.
 */
function detectPeriodFromSteps(steps) {
  if (!steps || !Array.isArray(steps)) return 2;

  // Filter to actual steps (stepNumber >= 1), exclude start position
  const realSteps = steps.filter((s) => s && (s.stepNumber >= 1 || s.isStep));
  const len = realSteps.length;

  if (len < 4 || len % 4 !== 0) return 2;

  // Extract startPosition from each step
  const positions = realSteps.map((s) => {
    // startPosition can be on the step directly or nested
    if (s.startPosition && typeof s.startPosition === "string") return s.startPosition;
    // Sometimes it's on the pictograph level
    return null;
  });

  const q = len / 4;
  const p0 = positions[0];
  const p1 = positions[q];
  const p2 = positions[q * 2];
  const p3 = positions[q * 3];

  if (!p0 || !p1 || !p2 || !p3) return 2;

  const cw =
    QUARTER_CW[p0] === p1 &&
    QUARTER_CW[p1] === p2 &&
    QUARTER_CW[p2] === p3;

  const ccw =
    QUARTER_CCW[p0] === p1 &&
    QUARTER_CCW[p1] === p2 &&
    QUARTER_CCW[p2] === p3;

  return cw || ccw ? 4 : 2;
}

async function backfillPeriod(commit = false) {
  console.log("\n=== Period Backfill ===\n");
  console.log(`Mode: ${commit ? "COMMIT" : "DRY RUN"}\n`);

  console.log("Loading public sequences...");
  const snapshot = await db.collection(PUBLIC_SEQUENCES).get();
  console.log(`Found ${snapshot.size} documents\n`);

  const updates = [];
  const skipped = [];
  const sourceReadCount = { total: 0, hit: 0, miss: 0 };

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const loopType = data.loopType;

    // Non-LOOP sequences: period = 1
    if (!loopType) {
      if (data.period === 1) {
        skipped.push({ id: docSnap.id, reason: "already period=1" });
        continue;
      }
      updates.push({ id: docSnap.id, word: data.word, period: 1, reason: "non-LOOP" });
      continue;
    }

    // Non-rotated LOOPs: always period = 2
    if (!isRotatedLoopType(loopType)) {
      if (data.period === 2) {
        skipped.push({ id: docSnap.id, reason: "already period=2" });
        continue;
      }
      updates.push({ id: docSnap.id, word: data.word, period: 2, reason: "non-rotated LOOP" });
      continue;
    }

    // Rotated LOOP: need to distinguish halved (2) vs quartered (4)
    // If already correctly set to 4, skip
    if (data.period === 4) {
      skipped.push({ id: docSnap.id, reason: "already period=4" });
      continue;
    }

    // Fetch source sequence to determine period
    const sourceRef = data.sourceRef;
    if (!sourceRef) {
      updates.push({
        id: docSnap.id,
        word: data.word,
        period: data.period ?? 2,
        reason: "no sourceRef, defaulting",
      });
      continue;
    }

    sourceReadCount.total++;

    try {
      const sourceDoc = await db.doc(sourceRef).get();

      if (!sourceDoc.exists) {
        sourceReadCount.miss++;
        updates.push({
          id: docSnap.id,
          word: data.word,
          period: data.period ?? 2,
          reason: "source deleted, defaulting",
        });
        continue;
      }

      sourceReadCount.hit++;
      const sourceData = sourceDoc.data();

      // Strategy 1: orientationCycleCount on source
      if (sourceData.orientationCycleCount === 4) {
        if (data.period === 4) {
          skipped.push({ id: docSnap.id, reason: "already period=4 (occ)" });
          continue;
        }
        updates.push({
          id: docSnap.id,
          word: data.word,
          period: 4,
          reason: "orientationCycleCount=4",
          previous: data.period,
        });
        continue;
      }

      // Strategy 2: position-based detection from steps
      const steps = sourceData.steps;
      const detected = detectPeriodFromSteps(steps);

      if (detected === data.period) {
        skipped.push({ id: docSnap.id, reason: `already period=${detected} (steps)` });
        continue;
      }

      updates.push({
        id: docSnap.id,
        word: data.word,
        period: detected,
        reason: detected === 4 ? "quarter-rotation detected from steps" : "halved (default)",
        previous: data.period,
      });
    } catch (err) {
      console.warn(`  Failed to read source for ${docSnap.id}: ${err.message}`);
      updates.push({
        id: docSnap.id,
        word: data.word,
        period: data.period ?? 2,
        reason: "source read failed, keeping current",
      });
    }
  }

  // Report
  console.log("=== Summary ===\n");
  console.log(`Total docs:      ${snapshot.size}`);
  console.log(`Skipped:         ${skipped.length}`);
  console.log(`To update:       ${updates.length}`);
  console.log(`Source reads:    ${sourceReadCount.total} (${sourceReadCount.hit} hit, ${sourceReadCount.miss} miss)\n`);

  // Period distribution
  const dist = { 1: 0, 2: 0, 4: 0 };
  for (const u of updates) dist[u.period] = (dist[u.period] || 0) + 1;
  for (const s of skipped) {
    const m = s.reason.match(/period=(\d)/);
    if (m) dist[parseInt(m[1])] = (dist[parseInt(m[1])] || 0) + 1;
  }
  console.log(`Period distribution: ${JSON.stringify(dist)}\n`);

  // Show quartered detections (most interesting)
  const quartered = updates.filter((u) => u.period === 4);
  if (quartered.length > 0) {
    console.log(`=== Quartered Detections (${quartered.length}) ===\n`);
    for (const q of quartered.slice(0, 20)) {
      console.log(`  ${q.word || q.id}: period ${q.previous ?? "unset"} → 4 (${q.reason})`);
    }
    if (quartered.length > 20) console.log(`  ... and ${quartered.length - 20} more`);
    console.log();
  }

  // Show sample updates
  if (updates.length > 0 && updates.length <= 30) {
    console.log("=== All Updates ===\n");
    for (const u of updates) {
      console.log(`  ${u.word || u.id}: → period=${u.period} (${u.reason})`);
    }
    console.log();
  }

  // Commit
  if (commit && updates.length > 0) {
    console.log("Committing...\n");
    let batch = db.batch();
    let count = 0;
    let committed = 0;

    for (const u of updates) {
      const ref = db.collection(PUBLIC_SEQUENCES).doc(u.id);
      batch.update(ref, {
        period: u.period,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;

      if (count >= 450) {
        await batch.commit();
        committed += count;
        console.log(`  Committed ${committed} so far...`);
        batch = db.batch();
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
      committed += count;
    }

    console.log(`\nDone. Updated ${committed} documents.\n`);
  } else if (!commit && updates.length > 0) {
    console.log("Re-run with --commit to apply.\n");
  } else {
    console.log("No updates needed.\n");
  }
}

const commit = process.argv.includes("--commit");
backfillPeriod(commit)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
