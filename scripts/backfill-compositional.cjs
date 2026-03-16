/**
 * Backfill compositional fields from source library docs into publicSequences.
 *
 * Makes each public index document self-contained so it can be rendered
 * without fetching from the owner's private library. Also backfills
 * contentHash for deduplication.
 *
 * For each public sequence:
 * 1. Read the source library doc via sourceRef
 * 2. Copy compositional fields (blueSoloProp, redSoloProp, stepPairings)
 * 3. Copy content hashes (bluePathHash, redPathHash, blueSoloHash, redSoloHash)
 * 4. Copy contentHash (full motion SHA-256)
 * 5. After backfill, report duplicate contentHashes for cleanup
 *
 * Usage:
 *   node scripts/backfill-compositional.cjs              (dry run, preview)
 *   node scripts/backfill-compositional.cjs --confirm    (write to Firestore)
 */

const admin = require("firebase-admin");
const { readFileSync } = require("fs");

// Load service account key
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

// Compositional fields to copy from source library doc to public index
const COMPOSITIONAL_FIELDS = [
  "blueSoloProp",
  "redSoloProp",
  "stepPairings",
  "bluePathHash",
  "redPathHash",
  "blueSoloHash",
  "redSoloHash",
  "contentHash",
];

async function backfill() {
  if (dryRun) {
    console.log("=== DRY RUN (pass --confirm to write) ===\n");
  } else {
    console.log("=== LIVE RUN - Writing to Firestore ===\n");
  }

  const publicSnapshot = await db.collection("publicSequences").get();

  let total = 0;
  let alreadyComplete = 0;
  let updated = 0;
  let noSourceRef = 0;
  let sourceNotFound = 0;
  let noCompositionalInSource = 0;
  let errors = 0;

  // Track contentHashes to find duplicates
  const contentHashMap = new Map(); // hash -> [{ docId, word }]

  for (const publicDoc of publicSnapshot.docs) {
    total++;
    const data = publicDoc.data();
    const word = data.word || data.name || publicDoc.id;

    // Track content hashes (even existing ones) for duplicate detection
    if (data.contentHash) {
      const existing = contentHashMap.get(data.contentHash) || [];
      existing.push({ docId: publicDoc.id, word });
      contentHashMap.set(data.contentHash, existing);
    }

    // Skip if already has all compositional fields
    if (
      data.blueSoloProp &&
      data.redSoloProp &&
      data.stepPairings?.length > 0 &&
      data.contentHash
    ) {
      alreadyComplete++;
      continue;
    }

    if (!data.sourceRef) {
      noSourceRef++;
      console.log(`  NO SOURCE REF: ${word} (${publicDoc.id})`);
      continue;
    }

    try {
      const sourceSnap = await db.doc(data.sourceRef).get();
      if (!sourceSnap.exists) {
        sourceNotFound++;
        console.log(`  SOURCE MISSING: ${word} -> ${data.sourceRef}`);
        continue;
      }

      const sourceData = sourceSnap.data();

      // Check if source has compositional fields
      if (!sourceData.blueSoloProp || !sourceData.redSoloProp) {
        noCompositionalInSource++;
        console.log(`  NO COMP IN SOURCE: ${word} (source lacks compositional fields)`);
        continue;
      }

      // Build update object with only the fields that exist in the source
      const update = {};
      for (const field of COMPOSITIONAL_FIELDS) {
        if (sourceData[field] !== undefined) {
          update[field] = sourceData[field];
        }
      }

      if (Object.keys(update).length === 0) {
        noCompositionalInSource++;
        continue;
      }

      // Track the content hash for duplicate detection
      if (sourceData.contentHash) {
        const existing = contentHashMap.get(sourceData.contentHash) || [];
        existing.push({ docId: publicDoc.id, word });
        contentHashMap.set(sourceData.contentHash, existing);
      }

      if (dryRun) {
        if (updated < 15) {
          const fields = Object.keys(update).join(", ");
          console.log(`  Would update: ${word} (${publicDoc.id}) <- ${fields}`);
        }
      } else {
        await db.collection("publicSequences").doc(publicDoc.id).update(update);
        if (updated < 15 || updated % 50 === 0) {
          console.log(`  Updated: ${word} (${publicDoc.id})`);
        }
      }
      updated++;
    } catch (err) {
      errors++;
      console.log(`  ERROR: ${word} (${publicDoc.id}) - ${err.message}`);
    }
  }

  // Report duplicates
  const duplicates = [];
  for (const [hash, entries] of contentHashMap) {
    if (entries.length > 1) {
      duplicates.push({ hash: hash.substring(0, 16) + "...", entries });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total public sequences: ${total}`);
  console.log(`Already complete: ${alreadyComplete}`);
  console.log(`${dryRun ? "Would update" : "Updated"}: ${updated}`);
  console.log(`No sourceRef: ${noSourceRef}`);
  console.log(`Source not found: ${sourceNotFound}`);
  console.log(`Source lacks compositional fields: ${noCompositionalInSource}`);
  console.log(`Errors: ${errors}`);

  if (duplicates.length > 0) {
    console.log(`\n=== DUPLICATES (same contentHash) ===`);
    for (const dup of duplicates) {
      console.log(`\n  Content hash: ${dup.hash}`);
      for (const entry of dup.entries) {
        console.log(`    - ${entry.word} (${entry.docId})`);
      }
    }
    console.log(
      `\n${duplicates.length} duplicate group(s) found. Review and delete the older entry from each group.`
    );
  } else {
    console.log(`\nNo duplicates found.`);
  }

  process.exit(0);
}

backfill().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
