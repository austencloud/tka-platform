/**
 * Clean up legacy sequence names in Firestore.
 *
 * Fixes two patterns:
 * 1. Trailing " Sequence" suffix (e.g. "Θ-X- Sequence" → "Θ-X-")
 * 2. Leading "Circular " prefix (e.g. "Circular LI" → "LI")
 * 3. Auto-generated timestamp names (e.g. "Sequence 1736185200000" → use word field)
 *
 * The name field should just be the TKA word. The isCircular flag already
 * tracks circularity, and the word field is the canonical source.
 *
 * Usage:
 *   node scripts/backfill-strip-sequence-suffix.cjs --dry-run   (preview)
 *   node scripts/backfill-strip-sequence-suffix.cjs --confirm    (write)
 */

const admin = require("firebase-admin");
const { readFileSync } = require("fs");

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const dryRun = !process.argv.includes("--confirm");

/**
 * Clean a name field by removing legacy prefixes/suffixes.
 * Returns the cleaned name, or null if no change needed.
 */
function cleanName(name, word) {
  if (!name || typeof name !== "string") return null;

  let cleaned = name;

  // Strip trailing " Sequence"
  cleaned = cleaned.replace(/\s+Sequence$/i, "");

  // Strip leading "Circular "
  cleaned = cleaned.replace(/^Circular\s+/i, "");

  // Auto-generated timestamp names like "Sequence 1736185200000" or "Sequence 6:15:49 PM"
  if (/^Sequence\s+/i.test(cleaned)) {
    cleaned = word || "";
  }

  if (cleaned === name) return null;
  return cleaned;
}

async function processCollection(collectionPath, label) {
  console.log(`\n--- ${label} ---`);

  let docs;
  if (collectionPath === "publicSequences") {
    const snap = await db.collection("publicSequences").get();
    docs = snap.docs;
  } else {
    // User library sequences: users/{uid}/sequences/{seqId}
    const usersSnap = await db.collection("users").get();
    docs = [];
    for (const userDoc of usersSnap.docs) {
      const seqSnap = await userDoc.ref.collection("sequences").get();
      docs.push(...seqSnap.docs);
    }
  }

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of docs) {
    const data = doc.data();
    const updates = {};

    const cleanedName = cleanName(data.name, data.word);
    if (cleanedName !== null) {
      updates.name = cleanedName;
    }

    const cleanedDisplayName = cleanName(data.displayName, data.word);
    if (cleanedDisplayName !== null) {
      updates.displayName = cleanedDisplayName;
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    console.log(`  ${doc.ref.path}: "${data.name}" → "${updates.name || data.name}"`);

    if (!dryRun) {
      batch.update(doc.ref, updates);
      batchCount++;

      // Firestore batches max at 500 writes
      if (batchCount >= 450) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    updated++;
  }

  if (!dryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log(`  ${label}: ${updated} updated, ${skipped} unchanged (${docs.length} total)`);
  return updated;
}

async function main() {
  if (dryRun) {
    console.log("=== DRY RUN (pass --confirm to write) ===");
  } else {
    console.log("=== LIVE RUN - Writing to Firestore ===");
  }

  const publicCount = await processCollection("publicSequences", "Public Index");
  const libraryCount = await processCollection("userSequences", "User Libraries");

  console.log(`\nTotal: ${publicCount + libraryCount} sequences cleaned`);

  if (dryRun && (publicCount + libraryCount) > 0) {
    console.log("\nRun with --confirm to apply changes.");
  }
}

main().catch(console.error);
