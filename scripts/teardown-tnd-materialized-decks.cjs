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
 * Targets (collection "TnD", excluding the base):
 *   - asymmetric === true             (blue|red enumerations)
 *   - symmetric turn variants         (turnPattern uniform with turns > 0)
 *   - named-pattern reversal variants (reversalPattern set)
 * PRESERVES: l1-vtg-motions (the zero-turn base — canonical source of truth).
 */

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

const BASE_ID = "l1-vtg-motions";
const APPLY = process.argv.includes("--apply");

async function main() {
  const snap = await db.collection("decks").get();
  const targets = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (doc.id === BASE_ID) return;
    if (d.collection !== "TnD") return;
    const isAsymmetric = d.asymmetric === true;
    const isSymmetricTurn =
      typeof d.turnPattern === "string" &&
      /^uniform[- ](\d+(?:\.\d+)?)t$/i.test(d.turnPattern) &&
      !/uniform[- ]0t/i.test(d.turnPattern);
    const isNamedReversal = !!d.reversalPattern && d.reversalPattern !== "";
    if (isAsymmetric || isSymmetricTurn || isNamedReversal) {
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
