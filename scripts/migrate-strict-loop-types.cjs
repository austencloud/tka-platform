/**
 * Migrate Strict LOOP Type Values in Firestore
 *
 * Renames "strict_rotated" → "rotated", "strict_mirrored" → "mirrored", etc.
 * in the `decks` collection. Handles both document field values and document IDs.
 *
 * Since Firestore document IDs are immutable, renaming a deck ID requires:
 *   1. Read the old document + all subcollection documents (sequences)
 *   2. Create a new document with the renamed ID
 *   3. Copy all subcollection documents to the new path
 *   4. Delete the old document and its subcollection documents
 *
 * Usage:
 *   node scripts/migrate-strict-loop-types.cjs --dry-run   # preview changes
 *   node scripts/migrate-strict-loop-types.cjs              # apply changes
 */

const admin = require("firebase-admin");
const path = require("path");

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");
const DECKS_COLLECTION = "decks";
const SEQUENCES_SUBCOLLECTION = "sequences";

/**
 * Map of old strict_ prefixed values to their new bare names.
 * Only the 5 strict_ prefixed types are renamed.
 * Compound types (swapped_inverted, rotated_inverted, etc.) are untouched.
 */
const RENAME_MAP = {
  strict_rotated: "rotated",
  strict_mirrored: "mirrored",
  strict_swapped: "swapped",
  strict_inverted: "inverted",
  strict_flipped: "flipped",
};

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
// Migration Logic
// ============================================================================

/**
 * Rename a loopType value if it matches any of the strict_ prefixed patterns.
 * Returns the new value, or null if no rename is needed.
 */
function renameLoopType(value) {
  if (typeof value !== "string") return null;
  return RENAME_MAP[value] || null;
}

/**
 * Rename a deck ID if it contains a strict_ prefixed segment.
 * Replaces the first matching strict_ prefix in the ID string.
 * Returns the new ID, or null if no rename is needed.
 */
function renameDeckId(deckId) {
  let newId = deckId;
  let changed = false;

  for (const [oldPrefix, newPrefix] of Object.entries(RENAME_MAP)) {
    if (newId.includes(oldPrefix)) {
      newId = newId.replace(oldPrefix, newPrefix);
      changed = true;
    }
  }

  return changed ? newId : null;
}

/**
 * Copy all documents from one subcollection to another.
 */
async function copySubcollection(sourceDocRef, targetDocRef) {
  const snapshot = await sourceDocRef.collection(SEQUENCES_SUBCOLLECTION).get();

  if (snapshot.empty) return 0;

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const targetSubRef = targetDocRef.collection(SEQUENCES_SUBCOLLECTION).doc(doc.id);
    batch.set(targetSubRef, doc.data());
    count++;
  }

  if (!DRY_RUN) {
    await batch.commit();
  }

  return count;
}

/**
 * Delete all documents in a subcollection.
 */
async function deleteSubcollection(docRef) {
  const snapshot = await docRef.collection(SEQUENCES_SUBCOLLECTION).get();

  if (snapshot.empty) return;

  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
  }

  if (!DRY_RUN) {
    await batch.commit();
  }
}

/**
 * Main migration function.
 */
async function migrate() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Migrate strict_ LOOP types ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}`);
  console.log(`${"=".repeat(60)}\n`);

  const decksSnapshot = await db.collection(DECKS_COLLECTION).get();
  console.log(`Found ${decksSnapshot.size} deck documents.\n`);

  let fieldUpdates = 0;
  let idRenames = 0;
  let sequencesCopied = 0;
  let errors = 0;

  for (const doc of decksSnapshot.docs) {
    const deckId = doc.id;
    const data = doc.data();
    const updates = {};

    // 1. Check if loopType field needs renaming
    if (data.loopType) {
      const newLoopType = renameLoopType(data.loopType);
      if (newLoopType) {
        updates.loopType = newLoopType;
        console.log(`  [field] ${deckId}: loopType "${data.loopType}" → "${newLoopType}"`);
        fieldUpdates++;
      }
    }

    // 2. Apply field updates (even if ID also needs renaming — we'll update the new doc)
    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      // If ID is also being renamed, we apply field updates to the new doc below.
      // Otherwise, update in place.
      const newDeckId = renameDeckId(deckId);
      if (!newDeckId) {
        await doc.ref.update(updates);
      }
    }

    // 3. Check if deck ID needs renaming
    const newDeckId = renameDeckId(deckId);
    if (newDeckId) {
      console.log(`  [id] "${deckId}" → "${newDeckId}"`);

      try {
        // Merge field updates with existing data for the new document
        const newData = { ...data, ...updates };
        const newDocRef = db.collection(DECKS_COLLECTION).doc(newDeckId);

        // Check if target already exists
        const targetDoc = await newDocRef.get();
        if (targetDoc.exists) {
          console.log(`    ⚠ Target "${newDeckId}" already exists — skipping`);
          errors++;
          continue;
        }

        if (!DRY_RUN) {
          // Create new document
          await newDocRef.set(newData);
        }

        // Copy subcollection
        const copiedCount = await copySubcollection(doc.ref, newDocRef);
        if (copiedCount > 0) {
          console.log(`    Copied ${copiedCount} sequences`);
          sequencesCopied += copiedCount;
        }

        if (!DRY_RUN) {
          // Delete old subcollection first, then old document
          await deleteSubcollection(doc.ref);
          await doc.ref.delete();
        }

        idRenames++;
      } catch (err) {
        console.error(`    ERROR migrating "${deckId}":`, err.message);
        errors++;
      }
    }
  }

  // Summary
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Summary ${DRY_RUN ? "(DRY RUN — no changes made)" : ""}`);
  console.log(`${"─".repeat(60)}`);
  console.log(`  Field updates:     ${fieldUpdates}`);
  console.log(`  ID renames:        ${idRenames}`);
  console.log(`  Sequences copied:  ${sequencesCopied}`);
  console.log(`  Errors:            ${errors}`);
  console.log(`${"─".repeat(60)}\n`);
}

// ============================================================================
// Entry Point
// ============================================================================

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
