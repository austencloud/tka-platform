#!/usr/bin/env node
/**
 * Cleanup Orphaned Public Sequences
 *
 * Removes entries from the `publicSequences` Firestore collection
 * where the `sourceRef` points to a document that no longer exists.
 *
 * These orphaned entries cause "Sequence not found" errors in Discover.
 *
 * Usage:
 *   node scripts/cleanup-orphaned-public-sequences.js           # Dry run (report only)
 *   node scripts/cleanup-orphaned-public-sequences.js --confirm # Actually remove orphans
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIRM_FLAG = process.argv.includes("--confirm");

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} catch (error) {
  console.error("❌ Failed to load service account. Make sure serviceAccountKey.json exists.");
  console.error(error.message);
  process.exit(1);
}

const db = admin.firestore();

async function cleanupOrphanedSequences() {
  console.log("🔍 Scanning publicSequences for orphaned entries...\n");

  // Get all public sequences
  const publicSeqRef = db.collection("publicSequences");
  const snapshot = await publicSeqRef.get();

  console.log(`📊 Total entries in publicSequences: ${snapshot.size}\n`);

  const orphaned = [];
  const valid = [];
  const noSourceRef = [];

  // Check each entry
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const word = data.word || data.name || doc.id;

    if (!data.sourceRef) {
      noSourceRef.push({ id: doc.id, word });
      continue;
    }

    // Check if sourceRef document exists
    try {
      const sourceDoc = await db.doc(data.sourceRef).get();
      if (sourceDoc.exists) {
        valid.push({ id: doc.id, word });
      } else {
        orphaned.push({
          id: doc.id,
          word,
          sourceRef: data.sourceRef,
        });
      }
    } catch (err) {
      // Permission error or invalid path - treat as orphaned
      orphaned.push({
        id: doc.id,
        word,
        sourceRef: data.sourceRef,
        error: err.message,
      });
    }
  }

  // Report findings
  console.log(`✅ Valid sequences: ${valid.length}`);
  console.log(`❌ Orphaned sequences: ${orphaned.length}`);
  console.log(`⚠️  No sourceRef: ${noSourceRef.length}\n`);

  if (orphaned.length === 0 && noSourceRef.length === 0) {
    console.log("🎉 No orphaned sequences found! Collection is clean.");
    process.exit(0);
  }

  // List orphaned sequences
  if (orphaned.length > 0) {
    console.log("Orphaned sequences (sourceRef document deleted):");
    console.log("─".repeat(80));
    for (const seq of orphaned) {
      console.log(`  • ${seq.word}`);
      console.log(`    ID: ${seq.id}`);
      console.log(`    sourceRef: ${seq.sourceRef}`);
      if (seq.error) console.log(`    error: ${seq.error}`);
      console.log("");
    }
    console.log("─".repeat(80));
  }

  if (noSourceRef.length > 0) {
    console.log("\nSequences without sourceRef (cannot load full data):");
    console.log("─".repeat(80));
    for (const seq of noSourceRef) {
      console.log(`  • ${seq.word} (ID: ${seq.id})`);
    }
    console.log("─".repeat(80));
  }

  if (!CONFIRM_FLAG) {
    console.log("\n⚠️  DRY RUN - No changes made.");
    console.log("   Run with --confirm to remove orphaned sequences.\n");
    console.log("   node scripts/cleanup-orphaned-public-sequences.js --confirm");
    process.exit(0);
  }

  // Actually remove orphaned sequences
  const toDelete = [...orphaned, ...noSourceRef];
  console.log(`\n🗑️  Removing ${toDelete.length} orphaned sequences...`);

  const batch = db.batch();
  for (const seq of toDelete) {
    batch.delete(publicSeqRef.doc(seq.id));
  }

  await batch.commit();

  console.log(`✅ Removed ${toDelete.length} orphaned sequences`);
  console.log(`📊 Remaining: ${valid.length} valid sequences`);
  console.log("\n🎉 Cleanup complete!");
}

cleanupOrphanedSequences()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
