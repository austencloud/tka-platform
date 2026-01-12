#!/usr/bin/env node
/**
 * Fix sequences where `word` is a UUID instead of the actual word
 *
 * This bug occurs when sequences are saved with their document ID as the word.
 * The fix sets `word` to the value from `name` or `metadata.name`.
 *
 * Usage:
 *   node scripts/fix-uuid-word-sequences.js           # Dry run
 *   node scripts/fix-uuid-word-sequences.js --confirm # Actually fix
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIRM_FLAG = process.argv.includes("--confirm");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  console.error("Failed to load service account:", error.message);
  process.exit(1);
}

const db = admin.firestore();

async function findAndFixUuidWords() {
  console.log("🔍 Scanning for sequences with UUID as word...\n");

  // Check a specific user's sequences (the admin user who had the issue)
  const adminUserId = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
  const problemSequences = [];

  // Get user's sequences
  const userSeqRef = db.collection("users").doc(adminUserId).collection("sequences");
  const snapshot = await userSeqRef.get();

  console.log(`📊 Checking ${snapshot.size} sequences for user ${adminUserId}\n`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const seqData = data.sequenceData || {};
    const metadata = data.metadata || {};

    const currentWord = seqData.word || data.word;
    const name = seqData.name || metadata.name || data.name;

    // Check if word looks like a UUID
    if (currentWord && UUID_PATTERN.test(currentWord)) {
      problemSequences.push({
        docId: doc.id,
        currentWord,
        suggestedWord: name,
        name,
        path: `users/${adminUserId}/sequences/${doc.id}`,
      });
    }
  }

  // Also check publicSequences
  const publicSnapshot = await db.collection("publicSequences").get();
  console.log(`📊 Checking ${publicSnapshot.size} public sequences\n`);

  for (const doc of publicSnapshot.docs) {
    const data = doc.data();
    const currentWord = data.word;
    const name = data.name;

    if (currentWord && UUID_PATTERN.test(currentWord)) {
      problemSequences.push({
        docId: doc.id,
        currentWord,
        suggestedWord: name,
        name,
        path: `publicSequences/${doc.id}`,
        isPublic: true,
      });
    }
  }

  if (problemSequences.length === 0) {
    console.log("✅ No sequences with UUID-as-word found!");
    return;
  }

  console.log(`❌ Found ${problemSequences.length} sequences with UUID as word:\n`);
  console.log("─".repeat(80));

  for (const seq of problemSequences) {
    console.log(`  • Document: ${seq.docId}`);
    console.log(`    Path: ${seq.path}`);
    console.log(`    Current word: ${seq.currentWord}`);
    console.log(`    Suggested word: ${seq.suggestedWord || "(no name available)"}`);
    console.log("");
  }
  console.log("─".repeat(80));

  if (!CONFIRM_FLAG) {
    console.log("\n⚠️  DRY RUN - No changes made.");
    console.log("   Run with --confirm to fix these sequences.\n");
    console.log("   node scripts/fix-uuid-word-sequences.js --confirm");
    return;
  }

  // Fix the sequences
  console.log("\n🔧 Fixing sequences...\n");

  for (const seq of problemSequences) {
    if (!seq.suggestedWord) {
      console.log(`  ⚠️  Skipping ${seq.docId} - no name available to use as word`);
      continue;
    }

    const docRef = db.doc(seq.path);
    const doc = await docRef.get();
    const data = doc.data();

    // Update the word field in the appropriate location
    if (seq.isPublic) {
      // Public sequence - update word directly
      await docRef.update({ word: seq.suggestedWord });
    } else {
      // User sequence - update in sequenceData
      const seqData = data.sequenceData || {};
      await docRef.update({
        word: seq.suggestedWord,
        "sequenceData.word": seq.suggestedWord,
      });
    }

    console.log(`  ✅ Fixed: ${seq.currentWord} → ${seq.suggestedWord}`);
  }

  console.log("\n🎉 Done!");
}

findAndFixUuidWords()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
