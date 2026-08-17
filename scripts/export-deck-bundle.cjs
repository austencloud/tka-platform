#!/usr/bin/env node
/**
 * Export Deck Bundle
 *
 * Exports all deck sequences from Firestore to JSON files for Tauri desktop bundling.
 * Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a Firebase service account key.
 *
 * Usage:
 *   node scripts/export-deck-bundle.cjs
 *   node scripts/export-deck-bundle.cjs --dry-run
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

const dryRun = process.argv.includes("--dry-run");
const outDir = path.resolve(__dirname, "../data/sequences");

// Exhaustive enumeration catalogs (tens of thousands of machine-generated
// LOOPs, 100+ MB each) are browsing data, not seed content — they would bloat
// the desktop installer and the git-tracked bundle by ~300 MB. Curated decks
// all sit far below this line.
const MAX_DECK_SEQUENCES = 2000;

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  console.error("Error: GOOGLE_APPLICATION_CREDENTIALS env var not set.");
  console.error("Point it to your Firebase service account key JSON file.");
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function exportAllDecks() {
  console.log("Fetching deck list from Firestore...");
  const decksSnapshot = await db.collection("catalogs").get();
  console.log(`Found ${decksSnapshot.size} decks.`);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let totalSequences = 0;
  const manifest = [];

  for (const deckDoc of decksSnapshot.docs) {
    const deckData = deckDoc.data();
    const deckId = deckDoc.id;
    const deckName = deckData.name || deckId;

    console.log(`\nExporting deck: ${deckName} (${deckId})`);

    const seqSnapshot = await db
      .collection("catalogs")
      .doc(deckId)
      .collection("sequences")
      .get();

    const sequences = [];
    for (const seqDoc of seqSnapshot.docs) {
      const data = seqDoc.data();
      // Strip Firestore Timestamps — convert to ISO strings for JSON serialization
      const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value === "object" && value._seconds !== undefined) {
          return new Date(value._seconds * 1000).toISOString();
        }
        return value;
      }));
      cleaned.id = seqDoc.id;
      sequences.push(cleaned);
    }

    if (sequences.length > MAX_DECK_SEQUENCES) {
      console.log(
        `  → Skipped: ${sequences.length} sequences exceeds the ${MAX_DECK_SEQUENCES} seed cap (enumeration catalog)`
      );
      continue;
    }

    totalSequences += sequences.length;
    console.log(`  → ${sequences.length} sequences`);

    // Generate filename from deck metadata
    const filename = `${deckId}.json`;
    const filePath = path.join(outDir, filename);

    const bundle = {
      deckId,
      deckName,
      metadata: {
        loopType: deckData.loopType || null,
        slice: deckData.slice || null,
        level: deckData.level || null,
        gridMode: deckData.gridMode || null,
        exportedAt: new Date().toISOString(),
        count: sequences.length,
      },
      sequences,
    };

    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(bundle));
      const sizeMB = (Buffer.byteLength(JSON.stringify(bundle)) / 1024 / 1024).toFixed(1);
      console.log(`  → Wrote ${filePath} (${sizeMB} MB)`);
    } else {
      console.log(`  → [dry-run] Would write ${filePath}`);
    }

    manifest.push({
      deckId,
      deckName,
      filename,
      count: sequences.length,
      loopType: deckData.loopType,
      slice: deckData.slice,
      level: deckData.level,
    });
  }

  // Write manifest file for the seeder to enumerate
  const manifestPath = path.join(outDir, "_manifest.json");
  if (!dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify({ decks: manifest, totalSequences, exportedAt: new Date().toISOString() }, null, 2));
    console.log(`\nManifest written to ${manifestPath}`);
  }

  console.log(`\nDone. ${totalSequences} sequences across ${decksSnapshot.size} decks.`);
  if (dryRun) console.log("(dry run — no files written)");
}

exportAllDecks().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
