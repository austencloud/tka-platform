/**
 * LOOP Period Migration Script (Phase 9)
 *
 * Adds the new period-domain fields to existing publicSequences documents:
 *   - period: integer passes to identity (derived from loopType + orientationCycleCount)
 *   - components: array of LOOPComponent strings (derived from loopType)
 *   - componentDomains: { [component]: "location" | "orientation" | "both" }
 *     (defaults to "location" for all migrated documents — conservative,
 *     since the detector's orientation pass runs on-demand anyway)
 *
 * Legacy fields (loopType, orientationCycleCount) stay intact — this
 * migration is purely additive. Phase 10 removes the legacy fields.
 *
 * Usage:
 *   node scripts/migrate-loop-period.cjs           # Dry run (default, safe)
 *   node scripts/migrate-loop-period.cjs --commit  # Write to Firestore
 *
 * Idempotent: documents that already have the new fields are skipped.
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

const PUBLIC_SEQUENCES_COLLECTION = "publicSequences";

// LOOPComponent string values — must stay in sync with
// src/lib/features/create/generate/shared/domain/models/generate-models.ts
const LOOP_COMPONENTS = {
  ROTATED: "rotated",
  MIRRORED: "mirrored",
  FLIPPED: "flipped",
  SWAPPED: "swapped",
  INVERTED: "inverted",
  REWOUND: "rewound",
};

/**
 * Derive integer period from legacy (loopType, orientationCycleCount).
 *
 * Rules:
 *   - orientationCycleCount > 1 wins (an extended sequence is at least that period)
 *   - loopType present (not null/empty) → period 2 default
 *   - otherwise period 1 (non-LOOP)
 */
function periodFromLegacy(loopType, orientationCycleCount) {
  if (orientationCycleCount && orientationCycleCount > 1) {
    return orientationCycleCount;
  }
  if (loopType) return 2;
  return 1;
}

/**
 * Parse a legacy loopType string into component IDs.
 *
 * loopType strings are underscore- or plus-joined component names:
 *   "rotated" → [ROTATED]
 *   "rotated_swapped" → [ROTATED, SWAPPED]
 *   "mirrored+rotated" → [MIRRORED, ROTATED]
 */
function parseComponents(loopType) {
  if (!loopType) return [];
  const lower = String(loopType).toLowerCase();
  const out = [];
  for (const [, value] of Object.entries(LOOP_COMPONENTS)) {
    if (lower.includes(value)) {
      out.push(value);
    }
  }
  return out;
}

/**
 * Compute the new fields for a sequence document. Returns null if the
 * document already has all new fields (idempotent skip).
 */
function computeNewFields(data) {
  const hasAllNewFields =
    typeof data.period === "number" &&
    Array.isArray(data.components) &&
    data.componentDomains !== undefined;

  if (hasAllNewFields) return null;

  const period = periodFromLegacy(data.loopType, data.orientationCycleCount);
  const components = parseComponents(data.loopType);
  const componentDomains = {};
  for (const c of components) {
    // Conservative default: location domain for all migrated components.
    // The on-demand detector refines this at read time if sequence steps
    // exist and orientation drift can be measured.
    componentDomains[c] = "location";
  }

  return { period, components, componentDomains };
}

async function migrate(commit = false) {
  console.log("\n=== LOOP Period Migration ===\n");
  console.log(
    `Mode: ${commit ? "COMMIT (will write to Firestore)" : "DRY RUN (preview only)"}\n`
  );

  console.log("Loading public sequences...");
  const snapshot = await db.collection(PUBLIC_SEQUENCES_COLLECTION).get();
  console.log(`Found ${snapshot.size} sequences\n`);

  let toUpdate = 0;
  let skipped = 0;
  const batch = commit ? db.batch() : null;
  const periodCounts = { 1: 0, 2: 0, 4: 0, 8: 0 };

  const reclassifications = []; // sequences whose period > current orientationCycleCount

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const newFields = computeNewFields(data);

    if (!newFields) {
      skipped++;
      continue;
    }

    periodCounts[newFields.period] = (periodCounts[newFields.period] ?? 0) + 1;
    toUpdate++;

    // Flag any cases where derived period exceeds the stored cycle count.
    if (
      data.orientationCycleCount &&
      newFields.period > data.orientationCycleCount
    ) {
      reclassifications.push({
        id: doc.id,
        word: data.word,
        oldCycle: data.orientationCycleCount,
        newPeriod: newFields.period,
      });
    }

    if (commit && batch) {
      batch.update(doc.ref, newFields);
    } else if (toUpdate <= 5) {
      // Sample log for dry-run inspection
      console.log(
        `[sample] ${doc.id} word=${data.word || "?"} loopType=${data.loopType || "null"} → period=${newFields.period} components=[${newFields.components.join(",")}]`
      );
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Documents needing update: ${toUpdate}`);
  console.log(`  Documents already migrated (skipped): ${skipped}`);
  console.log(`  Period distribution: ${JSON.stringify(periodCounts)}`);

  if (reclassifications.length > 0) {
    console.log(
      `\n  Reclassifications (period > orientationCycleCount): ${reclassifications.length}`
    );
    for (const r of reclassifications.slice(0, 10)) {
      console.log(
        `    ${r.id} (${r.word}): cycle=${r.oldCycle} → period=${r.newPeriod}`
      );
    }
    if (reclassifications.length > 10) {
      console.log(`    ... and ${reclassifications.length - 10} more`);
    }
  }

  if (commit && batch && toUpdate > 0) {
    console.log("\nCommitting batch...");
    // Firestore batch max = 500 operations. Split if larger.
    if (toUpdate > 500) {
      console.log(
        `  ⚠ ${toUpdate} updates exceeds Firestore batch limit of 500; splitting into multiple commits`
      );
      // Redo in chunks
      let chunkBatch = db.batch();
      let count = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const newFields = computeNewFields(data);
        if (!newFields) continue;
        chunkBatch.update(doc.ref, newFields);
        count++;
        if (count >= 450) {
          await chunkBatch.commit();
          chunkBatch = db.batch();
          count = 0;
          console.log(`  Committed chunk...`);
        }
      }
      if (count > 0) {
        await chunkBatch.commit();
      }
      console.log("  ✓ All chunks committed");
    } else {
      await batch.commit();
      console.log("  ✓ Batch committed");
    }
  } else if (!commit) {
    console.log("\n(Dry run — no writes. Re-run with --commit to apply.)");
  }
}

const commit = process.argv.includes("--commit");
migrate(commit)
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nError:", err);
    process.exit(1);
  });
