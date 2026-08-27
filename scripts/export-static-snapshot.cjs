#!/usr/bin/env node
/**
 * Export Firestore collections to static JSON files for long-term archival.
 *
 * If Firebase ever goes away, these JSON files (committed to git) let someone
 * reconstruct the entire QR code system and public sequence index.
 *
 * Exports:
 *   - shortcodes       -> data/snapshots/shortcodes.json
 *   - publicSequences   -> data/snapshots/public-sequences.json
 *
 * Usage:
 *   node scripts/export-static-snapshot.cjs
 *   node scripts/export-static-snapshot.cjs --collections=shortcodes
 *   node scripts/export-static-snapshot.cjs --collections=shortcodes,publicSequences
 */

const admin = require("firebase-admin");
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require("fs");
const path = require("path");

// Firebase Admin initialization (matches project convention)

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");

if (!existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("serviceAccountKey.json not found in project root.");
  console.error("Place your Firebase service account key there to run this script.");
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();

// Configuration

const SCHEMA_VERSION = 2;
const BATCH_SIZE = 500;
const OUTPUT_DIR = path.join(__dirname, "..", "static", "data", "snapshots");

// Emitted shape per collection. Default: skinny {_id, encoded} for shortcodes,
// full doc for publicSequences.
const COLLECTION_MAP = {
  shortcodes: { file: "shortcodes.json", skinny: true },
  publicSequences: { file: "public-sequences.json", skinny: false },
};

// CLI arg parsing

const collectionsArg = process.argv.find((a) => a.startsWith("--collections="));
const requestedCollections = collectionsArg
  ? collectionsArg.split("=")[1].split(",").map((c) => c.trim())
  : Object.keys(COLLECTION_MAP);

// Validate collection names
for (const name of requestedCollections) {
  if (!COLLECTION_MAP[name]) {
    console.error(`Unknown collection: "${name}"`);
    console.error(`Available: ${Object.keys(COLLECTION_MAP).join(", ")}`);
    process.exit(1);
  }
}

// Skinny projection for shortcodes — only what the v2 resolver needs.
// Drops sequenceData (84 MB saving), keeps encoded (the self-contained blob).
function projectSkinny(collectionName, docs) {
  if (collectionName !== "shortcodes") return docs;
  const out = [];
  let skipped = 0;
  for (const doc of docs) {
    if (!doc.encoded) {
      skipped++;
      continue;
    }
    out.push({ _id: doc._id, encoded: doc.encoded });
  }
  if (skipped > 0) {
    console.log(`  [${collectionName}] skipped ${skipped} docs without "encoded" field`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Paginated collection export
// ---------------------------------------------------------------------------

/**
 * Read every document in a Firestore collection using cursor-based pagination.
 * Returns an array of { id, ...data } objects.
 */
async function exportCollection(collectionName) {
  const collectionRef = db.collection(collectionName);
  const documents = [];
  let lastDoc = null;
  let batchNumber = 0;

  while (true) {
    let query = collectionRef.orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    batchNumber++;
    const batchDocs = snapshot.docs.map((doc) => ({
      _id: doc.id,
      ...doc.data(),
    }));
    documents.push(...batchDocs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    console.log(
      `  [${collectionName}] batch ${batchNumber}: ${snapshot.docs.length} docs (${documents.length} total)`
    );
  }

  return documents;
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Convert Firestore Timestamp objects to ISO strings so the JSON is portable.
 * Recursively walks the entire document tree.
 */
function sanitizeForJson(value) {
  if (value === null || value === undefined) return value;

  // Firestore Timestamp -> ISO string
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  // GeoPoint -> { latitude, longitude }
  if (value && typeof value.latitude === "number" && typeof value.longitude === "number" && value.constructor?.name === "GeoPoint") {
    return { latitude: value.latitude, longitude: value.longitude };
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map(sanitizeForJson);
  }

  // Plain objects
  if (typeof value === "object") {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = sanitizeForJson(val);
    }
    return result;
  }

  return value;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const exportTimestamp = new Date().toISOString();

  console.log("Firestore Static Snapshot Export");
  console.log(`Timestamp: ${exportTimestamp}`);
  console.log(`Collections: ${requestedCollections.join(", ")}`);
  console.log();

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const summary = [];

  for (const collectionName of requestedCollections) {
    const { file: filename } = COLLECTION_MAP[collectionName];
    const outputPath = path.join(OUTPUT_DIR, filename);

    console.log(`Exporting "${collectionName}"...`);
    const documents = await exportCollection(collectionName);
    const sanitized = sanitizeForJson(documents);
    const projected = projectSkinny(collectionName, sanitized);

    const envelope = {
      _meta: {
        exportedAt: exportTimestamp,
        schemaVersion: SCHEMA_VERSION,
        collection: collectionName,
        documentCount: projected.length,
      },
      documents: projected,
    };

    writeFileSync(outputPath, JSON.stringify(envelope), "utf8");
    console.log(
      `  -> ${path.relative(process.cwd(), outputPath)} ` +
      `(${projected.length} docs, ${(JSON.stringify(envelope).length / 1024 / 1024).toFixed(2)} MB)\n`
    );

    summary.push({ collection: collectionName, count: projected.length, file: filename });
  }

  // Print summary
  console.log("=== Export Summary ===");
  console.log(`Timestamp : ${exportTimestamp}`);
  console.log(`Schema    : v${SCHEMA_VERSION}`);
  console.log(`Output    : ${path.relative(process.cwd(), OUTPUT_DIR)}/`);
  for (const entry of summary) {
    console.log(`  ${entry.collection}: ${entry.count} documents -> ${entry.file}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Export failed:", err.message);
  process.exit(1);
});
