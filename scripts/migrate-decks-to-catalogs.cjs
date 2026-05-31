/**
 * Migrate the system-catalog collection from its legacy name `decks/` to
 * `catalogs/`.
 *
 * The `decks/` Firestore collection physically holds *Catalogs* (algorithmically
 * enumerated source pools), NOT the released printable Decks — those live in the
 * separate `deckReleases/` collection. The legacy name is the source of the
 * Catalog-vs-Deck confusion this migration removes.
 *
 * Structure (only one subcollection exists per catalog doc):
 *   decks/{catalogId}                      (doc)
 *   decks/{catalogId}/sequences/{seqId}    (subcollection docs)
 *
 * Strategy: COPY, never delete. Every doc + its `sequences` subcollection is
 * written to `catalogs/{catalogId}/...`. The old `decks/` collection is left
 * fully intact as a rollback safety net. Writes use set() so the migration is
 * idempotent (safe to re-run).
 *
 * Usage:
 *   node scripts/migrate-decks-to-catalogs.cjs --dry-run   # report only, no writes
 *   node scripts/migrate-decks-to-catalogs.cjs             # perform the copy
 *   node scripts/migrate-decks-to-catalogs.cjs --verify    # compare decks/ vs catalogs/ counts
 */

const admin = require("firebase-admin");
const path = require("path");

const SOURCE = "decks";
const DEST = "catalogs";
const SUBCOLLECTION = "sequences";

// Firestore caps a WriteBatch at 500 operations. Stay under it.
const BATCH_SIZE = 450;

const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY_ONLY = process.argv.includes("--verify");

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

/** Copy one catalog doc + its sequences subcollection from SOURCE to DEST. */
async function copyCatalog(catalogId, data) {
  // 1. The catalog document itself (its own small batch).
  if (!DRY_RUN) {
    await db.doc(`${DEST}/${catalogId}`).set(data);
  }

  // 2. The sequences subcollection, batched.
  const srcSeqs = await db.collection(`${SOURCE}/${catalogId}/${SUBCOLLECTION}`).get();
  let written = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const seqDoc of srcSeqs.docs) {
    if (!DRY_RUN) {
      batch.set(
        db.doc(`${DEST}/${catalogId}/${SUBCOLLECTION}/${seqDoc.id}`),
        seqDoc.data()
      );
      inBatch++;
      if (inBatch >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    written++;
  }
  if (!DRY_RUN && inBatch > 0) await batch.commit();

  return written;
}

/** Compare per-catalog doc + sequence counts between SOURCE and DEST. */
async function verify() {
  const src = await db.collection(SOURCE).get();
  const dst = await db.collection(DEST).get();
  console.log(`${SOURCE}/ docs: ${src.size}   ${DEST}/ docs: ${dst.size}`);

  const srcIds = new Set(src.docs.map((d) => d.id));
  const dstIds = new Set(dst.docs.map((d) => d.id));
  const missing = [...srcIds].filter((id) => !dstIds.has(id));
  if (missing.length) console.log(`  MISSING in ${DEST}/: ${missing.join(", ")}`);

  let mismatches = 0;
  let srcTotal = 0;
  let dstTotal = 0;
  for (const id of srcIds) {
    const sc = (await db.collection(`${SOURCE}/${id}/${SUBCOLLECTION}`).count().get()).data().count;
    const dc = dstIds.has(id)
      ? (await db.collection(`${DEST}/${id}/${SUBCOLLECTION}`).count().get()).data().count
      : 0;
    srcTotal += sc;
    dstTotal += dc;
    if (sc !== dc) {
      mismatches++;
      console.log(`  COUNT MISMATCH ${id}: ${SOURCE}=${sc} ${DEST}=${dc}`);
    }
  }
  console.log(`Total sequences  ${SOURCE}=${srcTotal}  ${DEST}=${dstTotal}`);
  console.log(
    mismatches === 0 && missing.length === 0
      ? "VERIFY OK — collections match."
      : `VERIFY FAILED — ${missing.length} missing docs, ${mismatches} count mismatches.`
  );
}

async function main() {
  if (VERIFY_ONLY) {
    console.log("=== Verify decks/ vs catalogs/ ===");
    await verify();
    return;
  }

  console.log(`=== Migrate ${SOURCE}/ -> ${DEST}/ ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  const src = await db.collection(SOURCE).get();
  console.log(`Found ${src.size} catalog docs in ${SOURCE}/\n`);

  let totalSeqs = 0;
  for (const catalogDoc of src.docs) {
    const n = await copyCatalog(catalogDoc.id, catalogDoc.data());
    totalSeqs += n;
    console.log(`  ${DRY_RUN ? "would copy" : "copied"} ${catalogDoc.id} (${n} sequences)`);
  }

  console.log(
    `\n${DRY_RUN ? "Would copy" : "Copied"} ${src.size} catalogs / ${totalSeqs} sequences to ${DEST}/`
  );
  if (DRY_RUN) {
    console.log("\n--- DRY RUN — no data written ---");
    console.log("Run without --dry-run to perform the copy, then --verify to confirm.");
  } else {
    console.log("\nSource decks/ left intact as rollback. Run --verify to confirm counts.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
