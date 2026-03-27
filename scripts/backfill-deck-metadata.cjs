/**
 * Backfill Deck Metadata
 *
 * Adds loopType, beatCount, and reversalPattern fields to existing deck documents
 * in Firestore. Only adds missing fields, never overwrites existing ones.
 *
 * Inference rules:
 *   loopType — from deck ID (e.g., "strict_rotated_..." → "strict_rotated")
 *   beatCount — from deck name using regex /(\d+)-Beat/
 *   reversalPattern — defaults to "continuous" if not set
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
  "strict_rotated",
  "strict_mirrored",
  "strict_swapped",
  "strict_inverted",
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
      return pattern; // Return the snake_case version directly
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
 * Compute metadata updates for a deck document.
 * Only includes fields that are missing from the current document.
 *
 * @param {string} deckId - The deck document ID
 * @param {Object} currentData - The current deck document data
 * @returns {Object} - Object with only the missing/new fields to set
 */
function computeUpdates(deckId, currentData) {
  const updates = {};

  // Infer loopType if missing
  if (currentData.loopType === undefined) {
    const inferred = inferLoopType(deckId);
    if (inferred) {
      updates.loopType = inferred;
    }
  }

  // Infer beatCount if missing
  if (currentData.beatCount === undefined) {
    const inferred = inferBeatCount(currentData.name || "");
    if (inferred) {
      updates.beatCount = inferred;
    }
  }

  // Set reversalPattern if missing
  if (currentData.reversalPattern === undefined) {
    updates.reversalPattern = "continuous";
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
        console.log(`  ${key}: ${typeof value === "string" ? `"${value}"` : value}`);
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
