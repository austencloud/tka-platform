#!/usr/bin/env node
/**
 * Export all curated Firestore catalog sequences for Tauri desktop bundling.
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a Firebase service account.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("node:fs");
const path = require("node:path");

const dryRun = process.argv.includes("--dry-run");
const outDir = path.resolve(__dirname, "../data/sequences");

// Exhaustive enumeration catalogs are browsing data, not offline seed content.
// Fetch one extra document so they can be rejected without downloading all rows.
const MAX_DECK_SEQUENCES = 2000;
const FIRESTORE_CONCURRENCY = 12;

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker()
    )
  );
  return results;
}

function cleanFirestoreValue(data) {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (value && typeof value === "object" && value._seconds !== undefined) {
        return new Date(value._seconds * 1000).toISOString();
      }
      return value;
    })
  );
}

async function fetchDeckBundle(db, deckDoc, exportedAt) {
  const deckData = deckDoc.data();
  const deckId = deckDoc.id;
  const deckName = deckData.name || deckId;
  const sequenceQuery = db
    .collection("catalogs")
    .doc(deckId)
    .collection("sequences")
    .limit(MAX_DECK_SEQUENCES + 1);
  const sequenceSnapshot = await sequenceQuery.get();

  if (sequenceSnapshot.size > MAX_DECK_SEQUENCES) {
    console.log(
      `Skipped ${deckName} (${deckId}): more than ${MAX_DECK_SEQUENCES} sequences.`
    );
    return null;
  }

  const sequences = sequenceSnapshot.docs.map((sequenceDoc) => ({
    ...cleanFirestoreValue(sequenceDoc.data()),
    id: sequenceDoc.id,
  }));
  const filename = `${deckId}.json`;
  console.log(
    `Exported ${deckName} (${deckId}): ${sequences.length} sequences.`
  );

  return {
    filename,
    manifestEntry: {
      deckId,
      deckName,
      filename,
      count: sequences.length,
      loopType: deckData.loopType,
      slice: deckData.slice,
      level: deckData.level,
    },
    bundle: {
      deckId,
      deckName,
      metadata: {
        loopType: deckData.loopType || null,
        slice: deckData.slice || null,
        level: deckData.level || null,
        gridMode: deckData.gridMode || null,
        exportedAt,
        count: sequences.length,
      },
      sequences,
    },
  };
}

function writeStagingBundle(parentDirectory, bundles, exportedAt) {
  fs.mkdirSync(parentDirectory, { recursive: true });
  const stagingDirectory = fs.mkdtempSync(
    path.join(parentDirectory, ".desktop-sequences-staging-")
  );
  fs.writeFileSync(path.join(stagingDirectory, ".gitkeep"), "");

  for (const result of bundles) {
    fs.writeFileSync(
      path.join(stagingDirectory, result.filename),
      JSON.stringify(result.bundle)
    );
  }

  const totalSequences = bundles.reduce(
    (sum, result) => sum + result.manifestEntry.count,
    0
  );
  fs.writeFileSync(
    path.join(stagingDirectory, "_manifest.json"),
    JSON.stringify(
      {
        decks: bundles.map((result) => result.manifestEntry),
        totalSequences,
        exportedAt,
      },
      null,
      2
    )
  );

  return { stagingDirectory, totalSequences };
}

function publishStagingBundle(stagingDirectory, destinationDirectory) {
  const backupDirectory = `${destinationDirectory}.backup-${process.pid}-${Date.now()}`;
  const hadExistingBundle = fs.existsSync(destinationDirectory);

  try {
    if (hadExistingBundle) {
      fs.renameSync(destinationDirectory, backupDirectory);
    }
    fs.renameSync(stagingDirectory, destinationDirectory);
  } catch (error) {
    if (fs.existsSync(destinationDirectory)) {
      fs.rmSync(destinationDirectory, { recursive: true, force: true });
    }
    if (hadExistingBundle && fs.existsSync(backupDirectory)) {
      fs.renameSync(backupDirectory, destinationDirectory);
    }
    throw error;
  }

  if (hadExistingBundle && fs.existsSync(backupDirectory)) {
    fs.rmSync(backupDirectory, { recursive: true, force: true });
  }
}

async function exportAllDecks(db) {
  console.log("Fetching desktop catalog list from Firestore...");
  const decksSnapshot = await db.collection("catalogs").get();
  const deckDocs = [...decksSnapshot.docs].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const exportedAt = new Date().toISOString();
  console.log(
    `Found ${deckDocs.length} catalogs; reading up to ${FIRESTORE_CONCURRENCY} concurrently.`
  );

  const results = await mapWithConcurrency(
    deckDocs,
    FIRESTORE_CONCURRENCY,
    (deckDoc) => fetchDeckBundle(db, deckDoc, exportedAt)
  );
  const bundles = results.filter(Boolean);
  const totalSequences = bundles.reduce(
    (sum, result) => sum + result.manifestEntry.count,
    0
  );

  if (dryRun) {
    console.log(
      `Dry run complete: ${totalSequences} sequences across ${bundles.length} curated decks.`
    );
    return;
  }

  const parentDirectory = path.dirname(outDir);
  const { stagingDirectory } = writeStagingBundle(
    parentDirectory,
    bundles,
    exportedAt
  );

  try {
    const { verifyDesktopSequenceBundle } =
      await import("./verify-desktop-sequence-bundle.mjs");
    verifyDesktopSequenceBundle(stagingDirectory);
    publishStagingBundle(stagingDirectory, outDir);
  } catch (error) {
    if (fs.existsSync(stagingDirectory)) {
      fs.rmSync(stagingDirectory, { recursive: true, force: true });
    }
    throw error;
  }

  console.log(
    `Desktop bundle published: ${totalSequences} sequences across ${bundles.length} curated decks.`
  );
}

async function main() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS must point to a Firebase service account key."
    );
  }

  const serviceAccount = require(path.resolve(serviceAccountPath));
  initializeApp({ credential: cert(serviceAccount) });
  await exportAllDecks(getFirestore());
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Desktop sequence export failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  cleanFirestoreValue,
  exportAllDecks,
  mapWithConcurrency,
  publishStagingBundle,
  writeStagingBundle,
};
