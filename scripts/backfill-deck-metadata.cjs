/**
 * Backfill Deck Metadata
 *
 * Migrates and adds fields to existing deck documents in Firestore.
 *
 * Phase 1 (original):
 *   loopType — from deck ID (e.g., "rotated_..." → "rotated")
 *   beatCount — from deck name using regex /(\d+)-Beat/
 *   reversalPattern — defaults to "continuous" if not set
 *
 * Phase 2 (Task 14 — Deck Browser Redesign):
 *   beatCount → stepCount — rename field
 *   turns → turnPattern — convert numeric turn value to pattern string
 *   collection — derive from deck ID ("vtg" → "VTG", else "LOOPs")
 *   sliceType — derive from deck ID ("quartered" → "quartered", else "halved")
 *   canonicalName — build from dimensions:
 *     "[SliceType] [LoopType] · [StepCount]-Step · [TurnPattern] · [ReversalPattern] · [GridMode]"
 *
 * Usage:
 *   node scripts/backfill-deck-metadata.cjs --dry-run  # preview changes
 *   node scripts/backfill-deck-metadata.cjs             # apply changes
 */

const admin = require("firebase-admin");
const path = require("path");

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");
const DECKS_COLLECTION = "decks";

// LOOP type patterns to match in deck ID (order matters - check longer strings first)
const LOOP_TYPE_PATTERNS = [
  "rotated",
  "mirrored",
  "swapped",
  "inverted",
  "rewound",
];

// ============================================================================
// Firebase Initialization
// ============================================================================

let db;

try {
  const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  db = admin.firestore();
} catch (error) {
  console.error("Failed to initialize Firebase:", error.message);
  process.exit(1);
}

// ============================================================================
// Turn Value to Pattern Mapping
// ============================================================================

const TURNS_TO_PATTERN = {
  0: "uniform-0t",
  0.5: "uniform-0.5t",
  1: "uniform-1t",
  1.5: "uniform-1.5t",
  2: "uniform-2t",
  2.5: "uniform-2.5t",
  3: "uniform-3t",
};

// ============================================================================
// Inference Functions
// ============================================================================

/**
 * Infer loopType from deck ID by checking for known patterns.
 * Returns the loopType (snake_case) or null if not found.
 *
 * @param {string} deckId - The deck document ID
 * @returns {string|null} - The inferred loopType or null
 */
function inferLoopType(deckId) {
  for (const pattern of LOOP_TYPE_PATTERNS) {
    if (deckId.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Infer beatCount from deck name by matching /(\d+)-Beat/
 * Returns the beat count or null if not found.
 *
 * @param {string} name - The deck name
 * @returns {number|null} - The beat count or null
 */
function inferBeatCount(name) {
  const match = name.match(/(\d+)-Beat/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Infer collection from deck ID.
 * IDs containing "vtg" get "VTG", everything else gets "LOOPs".
 *
 * @param {string} deckId
 * @returns {"VTG"|"LOOPs"}
 */
function inferCollection(deckId) {
  return deckId.toLowerCase().includes("vtg") ? "VTG" : "LOOPs";
}

/**
 * Infer sliceType from deck ID.
 * IDs containing "quartered" get "quartered", everything else gets "halved".
 *
 * @param {string} deckId
 * @returns {"quartered"|"halved"}
 */
function inferSliceType(deckId) {
  return deckId.toLowerCase().includes("quartered") ? "quartered" : "halved";
}

/**
 * Convert a numeric turns value to a turnPattern string.
 * Missing or unrecognized values default to "uniform-0t".
 *
 * @param {number|undefined} turns
 * @returns {string}
 */
function turnsToPattern(turns) {
  if (turns === undefined || turns === null) {
    return "uniform-0t";
  }
  return TURNS_TO_PATTERN[turns] || "uniform-0t";
}

/**
 * Format a turnPattern string for display in the canonical name.
 * "uniform-1t" → "Uniform 1T"
 *
 * @param {string} pattern
 * @returns {string}
 */
function formatTurnPattern(pattern) {
  return pattern
    .split("-")
    .map((part) => {
      // Turn values like "0.5t" should uppercase the T
      if (/^\d/.test(part)) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

/**
 * Format a reversalPattern string for display in the canonical name.
 * "continuous" → "Continuous", "blue-book" → "Blue Book"
 *
 * @param {string} pattern
 * @returns {string}
 */
function formatReversalPattern(pattern) {
  return pattern
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format a sliceType for display. "quartered" → "Quartered", "halved" → "Halved"
 *
 * @param {string} sliceType
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Build a canonical name from deck dimensions.
 *
 * Format: "[SliceType] [LoopType] · [StepCount]-Step · [TurnPattern] · [ReversalPattern] · [GridMode]"
 * Example: "Quartered Rotated · 8-Step · Uniform 0T · Continuous · Diamond"
 *
 * @param {Object} fields - The final merged fields for the deck
 * @returns {string}
 */
function buildCanonicalName(fields) {
  const parts = [];

  const sliceLabel = capitalize(fields.sliceType || "halved");
  const loopLabel = capitalize(fields.loopType || "unknown");
  parts.push(`${sliceLabel} ${loopLabel}`);

  if (fields.stepCount) {
    parts.push(`${fields.stepCount}-Step`);
  }

  if (fields.turnPattern) {
    parts.push(formatTurnPattern(fields.turnPattern));
  }

  if (fields.reversalPattern) {
    parts.push(formatReversalPattern(fields.reversalPattern));
  }

  if (fields.gridMode) {
    parts.push(capitalize(fields.gridMode));
  }

  return parts.join(" \u00B7 ");
}

/**
 * Compute metadata updates for a deck document.
 * Handles both Phase 1 (original) and Phase 2 (Task 14) migrations.
 * Only includes fields that are missing or need migration.
 *
 * @param {string} deckId - The deck document ID
 * @param {Object} currentData - The current deck document data
 * @returns {Object} - Object with only the fields to set/update
 */
function computeUpdates(deckId, currentData) {
  const updates = {};

  // --- Phase 1: Original backfill (loopType, reversalPattern) ---

  if (currentData.loopType === undefined) {
    const inferred = inferLoopType(deckId);
    if (inferred) {
      updates.loopType = inferred;
    }
  }

  if (currentData.reversalPattern === undefined) {
    updates.reversalPattern = "continuous";
  }

  // --- Phase 2: beatCount → stepCount rename ---

  if (currentData.stepCount === undefined) {
    if (currentData.beatCount !== undefined) {
      // Rename: copy beatCount value to stepCount
      updates.stepCount = currentData.beatCount;
    } else {
      // Neither exists — try to infer from name
      const inferred = inferBeatCount(currentData.name || "");
      if (inferred) {
        updates.stepCount = inferred;
      }
    }
  }

  // Also backfill beatCount for Phase 1 compat if it was never set
  // (the original script set beatCount, we keep that for any docs that need it)
  if (currentData.beatCount === undefined && currentData.stepCount !== undefined) {
    // stepCount already exists but beatCount doesn't — no need to set beatCount
    // We only migrate forward (beatCount → stepCount), not backward
  } else if (currentData.beatCount === undefined && updates.stepCount === undefined) {
    const inferred = inferBeatCount(currentData.name || "");
    if (inferred) {
      updates.beatCount = inferred;
    }
  }

  // --- Phase 2: turns → turnPattern conversion ---

  if (currentData.turnPattern === undefined) {
    updates.turnPattern = turnsToPattern(currentData.turns);
  }

  // --- Phase 2: collection ---

  if (currentData.collection === undefined) {
    updates.collection = inferCollection(deckId);
  }

  // --- Phase 2: sliceType ---

  if (currentData.sliceType === undefined) {
    updates.sliceType = inferSliceType(deckId);
  }

  // --- Phase 2: canonicalName ---

  if (currentData.canonicalName === undefined) {
    // Merge current data with updates to build canonical name from final values
    const merged = { ...currentData, ...updates };
    updates.canonicalName = buildCanonicalName(merged);
  }

  return updates;
}

// ============================================================================
// Main Execution
// ============================================================================

async function backfillMetadata() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Backfill Deck Metadata ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    // Load all deck documents
    const snapshot = await db.collection(DECKS_COLLECTION).get();

    if (snapshot.empty) {
      console.log("No deck documents found in Firestore.\n");
      return;
    }

    console.log(`Found ${snapshot.size} deck(s).\n`);

    let changedCount = 0;
    const changes = [];

    // Process each deck
    for (const doc of snapshot.docs) {
      const deckId = doc.id;
      const currentData = doc.data();

      // Compute what needs to be updated
      const updates = computeUpdates(deckId, currentData);

      if (Object.keys(updates).length > 0) {
        changedCount++;
        changes.push({
          id: deckId,
          name: currentData.name || "(no name)",
          updates,
          // Track old values for before/after logging on renamed fields
          oldBeatCount: currentData.beatCount,
          oldTurns: currentData.turns,
        });
      }
    }

    // Display changes
    if (changes.length === 0) {
      console.log("No changes needed. All decks are fully populated.\n");
      return;
    }

    console.log(`Changes needed for ${changedCount} deck(s):\n`);

    for (const change of changes) {
      console.log(`ID: ${change.id}`);
      console.log(`Name: ${change.name}`);
      console.log("Updates:");
      for (const [key, value] of Object.entries(change.updates)) {
        const formatted = typeof value === "string" ? `"${value}"` : value;

        // Show before/after for renamed fields
        if (key === "stepCount" && change.oldBeatCount !== undefined) {
          console.log(`  ${key}: ${formatted}  (was beatCount: ${change.oldBeatCount})`);
        } else if (key === "turnPattern" && change.oldTurns !== undefined) {
          console.log(`  ${key}: ${formatted}  (was turns: ${change.oldTurns})`);
        } else {
          console.log(`  ${key}: ${formatted}`);
        }
      }
      console.log();
    }

    // Apply changes if not a dry run
    if (!DRY_RUN) {
      console.log("Applying changes...\n");

      for (const change of changes) {
        await db.collection(DECKS_COLLECTION).doc(change.id).update(change.updates);
        console.log(`✓ Updated ${change.id}`);
      }

      console.log();
    }

    // Summary
    console.log(`${"=".repeat(80)}`);
    console.log(`Summary:`);
    console.log(`  Total decks: ${snapshot.size}`);
    console.log(`  Decks changed: ${changedCount}`);
    console.log(`  Status: ${DRY_RUN ? "DRY RUN - no changes applied" : "Changes applied"}`);
    console.log(`${"=".repeat(80)}\n`);

  } catch (error) {
    console.error("Error during backfill:", error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

// Run the backfill
backfillMetadata();
