/**
 * Teardown redundant materialized TnD decks.
 *
 * Once turns are applied at render time (deck-variation + deck-composer cartesian),
 * the materialized turn/asymmetric/named-reversal decks are redundant. This script
 * lists them (dry run) and, with --apply, deletes each deck + its sequences.
 *
 * Usage:
 *   node scripts/teardown-tnd-materialized-decks.cjs           # dry run: list only
 *   node scripts/teardown-tnd-materialized-decks.cjs --apply   # delete (after sign-off)
 *
 * Targets (collection "TnD", excluding the base) — ONLY decks reproducible at
 * render time OR reseedable by an existing script:
 *   - asymmetric === true                 (reseed: seed-tnd-asymmetric-decks.cjs)
 *   - symmetric turn variants             (reseed: seed-tnd-turn-decks.cjs)
 *   - RESEEDABLE named-reversal variants  (reseed: reseed-all-reversal-decks.cjs)
 *
 * PRESERVES:
 *   - l1-tnd-motions (the zero-turn base — canonical source of truth)
 *   - any deck whose reversalPattern is NOT a reseedable named pattern (e.g. the
 *     raw "BB--" pattern), because no seed script regenerates it.
 */

// Reversal patterns reseed-all-reversal-decks.cjs (via apply-reversal-pattern.cjs)
// can regenerate. Raw patterns like "BB--" are NOT here and are preserved.
const RESEEDABLE_REVERSALS = new Set([
  "book",
  "red-book",
  "blue-book",
  "long-book",
  "alternating",
]);

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
let db;
try {
  const serviceAccount = require(serviceAccountPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
} catch (error) {
  console.error("Failed to initialize Firebase:", error.message);
  process.exit(1);
}

const BASE_ID = "l1-tnd-motions";
const APPLY = process.argv.includes("--apply");

async function main() {
  const snap = await db.collection("decks").get();
  const targets = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (doc.id === BASE_ID) return;
    if (d.collection !== "TnD") return;
    // Preserve any deck carrying a reversal pattern no seed script can regenerate
    // (e.g. the raw "BB--" pattern), even if it also has a turn applied. Not
    // reseedable → must not delete. "continuous"/"" mean no reversal (reseedable).
    const rev = d.reversalPattern;
    const blockedReversal =
      !!rev && rev !== "" && rev !== "continuous" && !RESEEDABLE_REVERSALS.has(rev);
    if (blockedReversal) return;
    const isAsymmetric = d.asymmetric === true;
    const isSymmetricTurn =
      typeof d.turnPattern === "string" &&
      /^uniform[- ](\d+(?:\.\d+)?)t$/i.test(d.turnPattern) &&
      !/uniform[- ]0t/i.test(d.turnPattern);
    const isReseedableReversal =
      !!d.reversalPattern && RESEEDABLE_REVERSALS.has(d.reversalPattern);
    if (isAsymmetric || isSymmetricTurn || isReseedableReversal) {
      targets.push(doc.id);
    }
  });

  console.log(`Found ${targets.length} teardown targets (BASE ${BASE_ID} preserved):`);
  for (const id of targets.sort()) console.log("  " + id);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --apply after sign-off.");
    return;
  }

  for (const id of targets) {
    const seqs = await db.collection("decks").doc(id).collection("sequences").get();
    const batchLimit = 450;
    let batch = db.batch();
    let n = 0;
    for (const s of seqs.docs) {
      batch.delete(s.ref);
      if (++n % batchLimit === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
    await db.collection("decks").doc(id).delete();
    console.log(`Deleted ${id} (+${seqs.size} sequences)`);
  }
  console.log(`\nDeleted ${targets.length} decks.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
