#!/usr/bin/env node
/**
 * Prune Decks — Delete unwanted decks and their sequences subcollections.
 *
 * Keeps:
 *   - All TnD decks (collection === "TnD")
 *   - l1-halved-strict-rotated-4beat (period 2, 47 seq)
 *   - l1-halved-strict-rotated-8beat (period 4, 22595 seq)
 *   - l1-quartered-strict-rotated-8beat (period 2, 128 seq)
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
const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith("--concurrency="))?.split("=")[1] || "10", 10);

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

async function deleteDeckAndSequences(deckId, index, total) {
  const seqRef = db.collection("catalogs").doc(deckId).collection("sequences");
  let totalDeleted = 0;

  while (true) {
    const batch = db.batch();
    const snap = await seqRef.limit(500).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snap.size;
  }

  await db.collection("catalogs").doc(deckId).delete();
  console.log(`[${index}/${total}] Deleted ${deckId} (${totalDeleted} sequences)`);
  return totalDeleted;
}

async function main() {
  const snap = await db.collection("catalogs").get();
  const allDecks = snap.docs.map((d) => ({
    id: d.id,
    collection: d.data().collection || "",
    name: d.data().name || "",
    totalSequences: d.data().totalSequences || 0,
  }));

  const toKeep = [];
  const toDelete = [];

  for (const deck of allDecks) {
    if (deck.collection === "TnD" || KEEP_IDS.has(deck.id)) {
      toKeep.push(deck);
    } else {
      toDelete.push(deck);
    }
  }

  console.log(`\n=== Deck Pruning ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} — concurrency: ${CONCURRENCY} ===\n`);
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

  console.log(`\nDeleting ${toDelete.length} decks with concurrency ${CONCURRENCY}...\n`);

  const sorted = toDelete.sort((a, b) => a.id.localeCompare(b.id));
  let completed = 0;
  let seqTotal = 0;
  const startTime = Date.now();

  // Process in parallel batches
  for (let i = 0; i < sorted.length; i += CONCURRENCY) {
    const chunk = sorted.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((deck, j) => deleteDeckAndSequences(deck.id, i + j + 1, sorted.length))
    );
    completed += chunk.length;
    seqTotal += results.reduce((a, b) => a + b, 0);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`--- batch done: ${completed}/${sorted.length} decks, ${seqTotal} seq deleted, ${elapsed}s elapsed ---`);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone. ${sorted.length} decks, ${seqTotal} sequences deleted in ${totalElapsed}s.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
