#!/usr/bin/env node
/**
 * Prune Decks — Delete unwanted decks and their sequences subcollections.
 *
 * Keeps:
 *   - All VTG decks (collection === "VTG")
 *   - l1-halved-strict-rotated-4beat (period 2, 47 seq)
 *   - l1-halved-strict-rotated-8beat (period 4, 22595 seq)
 *   - l1-quartered-strict-rotated-12beat (period 3, 1606 seq)
 *   - l1-quartered-strict-rotated-16beat (period 4, 27892 seq)
 *
 * Deletes everything else (6-step source + all reversal variants).
 *
 * Usage:
 *   node scripts/prune-decks.cjs --dry-run     # Preview what would be deleted
 *   node scripts/prune-decks.cjs               # Actually delete
 */

const admin = require("firebase-admin");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
const sa = require(serviceAccountPath);
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const KEEP_IDS = new Set([
  "l1-halved-strict-rotated-4beat",
  "l1-halved-strict-rotated-8beat",
  "l1-quartered-strict-rotated-8beat",
  "l1-quartered-strict-rotated-12beat",
  "l1-quartered-strict-rotated-16beat",
]);

async function deleteDeckAndSequences(deckId) {
  const seqRef = db.collection("decks").doc(deckId).collection("sequences");
  const seqSnap = await seqRef.get();

  if (!DRY_RUN) {
    const BATCH_SIZE = 500;
    const docs = seqSnap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const slice = docs.slice(i, i + BATCH_SIZE);
      for (const doc of slice) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }
    await db.collection("decks").doc(deckId).delete();
  }

  return seqSnap.size;
}

async function main() {
  const snap = await db.collection("decks").get();
  const allDecks = snap.docs.map((d) => ({
    id: d.id,
    collection: d.data().collection || "",
    name: d.data().name || "",
    totalSequences: d.data().totalSequences || 0,
  }));

  const toKeep = [];
  const toDelete = [];

  for (const deck of allDecks) {
    if (deck.collection === "VTG" || KEEP_IDS.has(deck.id)) {
      toKeep.push(deck);
    } else {
      toDelete.push(deck);
    }
  }

  console.log(`\n=== Deck Pruning ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ===\n`);
  console.log(`Total decks: ${allDecks.length}`);
  console.log(`Keeping: ${toKeep.length}`);
  console.log(`Deleting: ${toDelete.length}\n`);

  console.log("--- KEEPING ---");
  for (const d of toKeep.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log(`  ${d.id} (${d.totalSequences} seq)`);
  }

  console.log("\n--- DELETING ---");
  let totalSeqDeleted = 0;
  for (const d of toDelete.sort((a, b) => a.id.localeCompare(b.id))) {
    console.log(`  ${d.id} (${d.totalSequences} seq)`);
    totalSeqDeleted += d.totalSequences;
  }
  console.log(`\nTotal sequences to delete: ${totalSeqDeleted}`);

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes made. Run without --dry-run to delete.");
    return;
  }

  console.log("\nDeleting...\n");
  let completed = 0;
  for (const deck of toDelete) {
    completed++;
    const seqCount = await deleteDeckAndSequences(deck.id);
    console.log(`[${completed}/${toDelete.length}] Deleted ${deck.id} (${seqCount} sequences)`);
  }

  console.log(`\nDone. ${toDelete.length} decks deleted.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
