#!/usr/bin/env node
/**
 * Sync Missing Public Sequences
 *
 * Finds sequences marked as `visibility: "public"` in user libraries
 * that are missing from the `publicSequences` index collection.
 *
 * Usage:
 *   node scripts/sync-missing-public-sequences.js           # Dry run
 *   node scripts/sync-missing-public-sequences.js --confirm # Sync missing sequences
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
  console.error("Failed to load service account:", error.message);
  process.exit(1);
}

const db = admin.firestore();

async function syncMissingPublicSequences() {
  console.log("🔍 Finding sequences marked public but missing from index...\n");

  // Get all existing public sequence IDs
  const publicSnapshot = await db.collection("publicSequences").get();
  const publicIds = new Set(publicSnapshot.docs.map(d => d.id));
  console.log(`📊 Current publicSequences entries: ${publicIds.size}\n`);

  // Find all users
  const usersSnapshot = await db.collection("users").get();
  console.log(`👥 Checking ${usersSnapshot.size} users...\n`);

  const missingSequences = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();

    // Get user's sequences marked as public
    const seqRef = db.collection(`users/${userId}/sequences`);
    const seqSnapshot = await seqRef.where("metadata.visibility", "==", "public").get();

    for (const seqDoc of seqSnapshot.docs) {
      const seqId = seqDoc.id;

      if (!publicIds.has(seqId)) {
        const data = seqDoc.data();
        const seqData = data.sequenceData || {};
        const metadata = data.metadata || {};

        // Derive word from beats
        const beats = data.beats || seqData.beats || [];
        let word = null;
        if (beats.length > 0) {
          word = beats
            .map(b => b.letter || "")
            .filter(l => l !== "")
            .join("");
        }
        if (!word) {
          word = data.word || seqData.word || data.name || seqData.name || metadata.name || seqId;
        }

        missingSequences.push({
          id: seqId,
          userId,
          userName: userData.displayName || "Unknown",
          word,
          name: seqData.name || metadata.name || data.name,
          thumbnails: (data.thumbnails || seqData.thumbnails || []).slice(0, 3),
          beatsCount: beats.length,
          difficultyLevel: seqData.difficultyLevel || data.difficultyLevel,
        });
      }
    }
  }

  if (missingSequences.length === 0) {
    console.log("✅ All public sequences are indexed!");
    return;
  }

  console.log(`❌ Found ${missingSequences.length} sequences missing from publicSequences:\n`);
  console.log("─".repeat(80));

  for (const seq of missingSequences) {
    console.log(`  • ${seq.word || seq.name || seq.id}`);
    console.log(`    ID: ${seq.id}`);
    console.log(`    User: ${seq.userName} (${seq.userId})`);
    console.log(`    Beats: ${seq.beatsCount}`);
    console.log("");
  }
  console.log("─".repeat(80));

  if (!CONFIRM_FLAG) {
    console.log("\n⚠️  DRY RUN - No changes made.");
    console.log("   Run with --confirm to sync these sequences.\n");
    console.log("   node scripts/sync-missing-public-sequences.js --confirm");
    return;
  }

  // Sync missing sequences
  console.log("\n📤 Syncing missing sequences to publicSequences...\n");

  for (const seq of missingSequences) {
    const userDoc = await db.doc(`users/${seq.userId}`).get();
    const userData = userDoc.data() || {};

    // Build public data, omitting undefined values
    const publicData = {
      id: seq.id,
      sourceRef: `users/${seq.userId}/sequences/${seq.id}`,
      ownerId: seq.userId,
      ownerDisplayName: userData.displayName || "Unknown",
      name: seq.name || seq.word,
      word: seq.word,
      thumbnails: seq.thumbnails || [],
      sequenceLength: seq.beatsCount || 0,
      viewCount: 0,
      starCount: 0,
      tags: [],
      isForked: false,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Add optional fields only if defined
    if (userData.photoURL) publicData.ownerAvatarUrl = userData.photoURL;
    if (seq.difficultyLevel) publicData.difficultyLevel = seq.difficultyLevel;

    await db.doc(`publicSequences/${seq.id}`).set(publicData);
    console.log(`  ✅ Synced: ${seq.word || seq.name}`);
  }

  console.log(`\n🎉 Synced ${missingSequences.length} sequences to publicSequences!`);
}

syncMissingPublicSequences()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
