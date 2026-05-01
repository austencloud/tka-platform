#!/usr/bin/env node
/**
 * Cleanup Orphaned Public Sequences
 *
 * Finds public sequence index entries where the source document no longer exists.
 * These create broken thumbnails and "Sequence not found" errors.
 *
 * Prerequisites:
 *   Ensure serviceAccountKey.json exists in project root
 *
 * Usage:
 *   node scripts/cleanup-orphaned-public-sequences.cjs           # Dry run (shows what would be deleted)
 *   node scripts/cleanup-orphaned-public-sequences.cjs --delete  # Actually delete orphaned entries
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Initialize Firebase Admin with service account
const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error("❌ serviceAccountKey.json not found in project root");
  console.error("   Download from Firebase Console > Project Settings > Service Accounts");
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();

async function findOrphanedPublicSequences() {
  console.log("Scanning publicSequences collection for orphans...\n");

  const publicSeqSnapshot = await db.collection("publicSequences").get();
  console.log(`Found ${publicSeqSnapshot.size} public sequence entries\n`);

  const orphans = [];
  const valid = [];
  const noSteps = [];

  for (const docSnap of publicSeqSnapshot.docs) {
    const data = docSnap.data();
    const sourceRef = data.sourceRef;

    if (!sourceRef) {
      console.log(`❓ Missing sourceRef: "${data.word}" (doc: ${docSnap.id})`);
      orphans.push({
        id: docSnap.id,
        word: data.word,
        ownerId: data.ownerId,
        ownerDisplayName: data.ownerDisplayName,
        reason: "missing_sourceRef",
      });
      continue;
    }

    // Check if source document exists
    try {
      const sourceDoc = await db.doc(sourceRef).get();
      if (!sourceDoc.exists) {
        console.log(
          `🗑️  Orphan: "${data.word}" - source deleted (${sourceRef})`
        );
        orphans.push({
          id: docSnap.id,
          word: data.word,
          ownerId: data.ownerId,
          ownerDisplayName: data.ownerDisplayName,
          sourceRef,
          reason: "source_deleted",
        });
      } else {
        // Check if source has steps/beats
        const sourceData = sourceDoc.data();
        const steps = sourceData.steps || sourceData.beats || [];
        if (steps.length === 0) {
          console.log(
            `⚠️  No steps: "${data.word}" by ${data.ownerDisplayName} (${steps.length} steps)`
          );
          noSteps.push({
            id: docSnap.id,
            word: data.word,
            ownerId: data.ownerId,
            ownerDisplayName: data.ownerDisplayName,
            sourceRef,
          });
        }
        valid.push({
          id: docSnap.id,
          word: data.word,
          hasSteps: steps.length > 0,
          stepsCount: steps.length,
        });
      }
    } catch (error) {
      console.log(
        `⚠️  Error checking "${data.word}": ${error.message}`
      );
      orphans.push({
        id: docSnap.id,
        word: data.word,
        ownerId: data.ownerId,
        ownerDisplayName: data.ownerDisplayName,
        sourceRef,
        reason: "check_failed",
        error: error.message,
      });
    }
  }

  return { orphans, valid, noSteps };
}

async function deleteOrphans(orphans) {
  console.log(`\nDeleting ${orphans.length} orphaned entries...\n`);

  let deleted = 0;
  let failed = 0;

  for (const orphan of orphans) {
    try {
      await db.collection("publicSequences").doc(orphan.id).delete();
      console.log(`✅ Deleted: "${orphan.word}" (${orphan.id})`);
      deleted++;
    } catch (error) {
      console.log(`❌ Failed to delete "${orphan.word}": ${error.message}`);
      failed++;
    }
  }

  return { deleted, failed };
}

async function checkUserSequences(userId, displayName, shouldSync = false) {
  console.log(`\nChecking sequences for ${displayName} (${userId})...\n`);

  // Get user profile for owner info
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const ownerDisplayName = userData.displayName || "Unknown";
  const ownerAvatarUrl = userData.photoURL;

  const userSeqSnapshot = await db.collection(`users/${userId}/sequences`).get();
  console.log(`Found ${userSeqSnapshot.size} sequences in library\n`);

  const publicSequences = [];
  const privateSequences = [];
  const noStepsSeq = [];
  const notIndexed = [];

  userSeqSnapshot.forEach(docSnap => {
    const data = docSnap.data();
    const steps = data.steps || data.beats || [];
    const word = data.word || data.name || docSnap.id;

    const info = {
      id: docSnap.id,
      word,
      visibility: data.visibility || 'unknown',
      hasSteps: steps.length > 0,
      stepsCount: steps.length,
      data, // Keep full data for sync
    };

    if (data.visibility === 'public') {
      publicSequences.push(info);
    } else {
      privateSequences.push(info);
    }

    if (steps.length === 0) {
      noStepsSeq.push(info);
    }
  });

  console.log(`Public sequences: ${publicSequences.length}`);
  console.log(`Private sequences: ${privateSequences.length}`);
  console.log(`Sequences without steps: ${noStepsSeq.length}`);

  if (noStepsSeq.length > 0) {
    console.log("\nSequences without steps:");
    noStepsSeq.forEach(s => console.log(`  - "${s.word}" (${s.visibility})`));
  }

  // Check if public sequences are in publicSequences collection
  console.log("\nChecking if public sequences are indexed...");
  let indexedCount = 0;

  for (const seq of publicSequences) {
    const publicDoc = await db.collection("publicSequences").doc(seq.id).get();
    if (publicDoc.exists) {
      indexedCount++;
    } else {
      notIndexed.push(seq);
      console.log(`  ❌ NOT INDEXED: "${seq.word}" (${seq.stepsCount} steps)`);
    }
  }

  console.log(`\nIndexed in publicSequences: ${indexedCount}/${publicSequences.length}`);

  if (notIndexed.length > 0) {
    console.log(`⚠️  ${notIndexed.length} public sequences are NOT in the public index!`);

    if (shouldSync) {
      console.log("\n🔄 Syncing missing sequences to public index...\n");

      for (const seq of notIndexed) {
        try {
          const publicData = {
            id: seq.id,
            sourceRef: `users/${userId}/sequences/${seq.id}`,
            ownerId: userId,
            ownerDisplayName,
            ownerAvatarUrl: ownerAvatarUrl || null,
            name: seq.data.name || seq.word,
            displayName: seq.data.displayName || null,
            word: seq.word,
            thumbnails: seq.data.thumbnails || [],
            sequenceLength: seq.stepsCount,
            difficultyLevel: seq.data.difficultyLevel || null,
            viewCount: seq.data.viewCount || 0,
            starCount: seq.data.starCount || 0,
            tags: [],
            isForked: seq.data.source === "forked",
            originalCreatorId: seq.data.forkAttribution?.originalCreatorId || null,
            originalCreatorName: seq.data.forkAttribution?.originalCreatorName || null,
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          await db.collection("publicSequences").doc(seq.id).set(publicData);
          console.log(`  ✅ Synced: "${seq.word}"`);
        } catch (error) {
          console.log(`  ❌ Failed to sync "${seq.word}": ${error.message}`);
        }
      }

      console.log("\n✨ Sync complete!");
    } else {
      console.log("\nRun with --sync to add missing sequences to public index");
    }
  }
}

async function syncAllMissingPublicSequences() {
  console.log("Scanning ALL users for public sequences missing from index...\n");

  const usersSnapshot = await db.collection("users").get();
  console.log(`Found ${usersSnapshot.size} users\n`);

  let totalMissing = 0;
  let totalSynced = 0;
  const usersMissingSequences = [];

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    const displayName = userData.displayName || "Unknown";

    // Get user's sequences
    const seqSnapshot = await db.collection(`users/${userId}/sequences`).get();
    if (seqSnapshot.empty) continue;

    const missingSeqs = [];

    for (const seqDoc of seqSnapshot.docs) {
      const data = seqDoc.data();
      if (data.visibility !== "public") continue;

      // Check if indexed
      const publicDoc = await db.collection("publicSequences").doc(seqDoc.id).get();
      if (!publicDoc.exists) {
        const steps = data.steps || data.beats || [];
        if (steps.length > 0) {
          missingSeqs.push({
            id: seqDoc.id,
            word: data.word || data.name || seqDoc.id,
            stepsCount: steps.length,
            data,
          });
        }
      }
    }

    if (missingSeqs.length > 0) {
      totalMissing += missingSeqs.length;
      usersMissingSequences.push({
        userId,
        displayName,
        avatarUrl: userData.photoURL,
        sequences: missingSeqs,
      });
      console.log(`  ${displayName}: ${missingSeqs.length} missing`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Total missing sequences: ${totalMissing}`);
  console.log(`Users affected: ${usersMissingSequences.length}`);

  if (totalMissing === 0) {
    console.log("\n✨ All public sequences are already indexed!");
    return;
  }

  const shouldSync = process.argv.includes("--sync");
  if (!shouldSync) {
    console.log("\nRun with --sync to add all missing sequences to public index");
    return;
  }

  console.log("\n🔄 Syncing all missing sequences...\n");

  for (const user of usersMissingSequences) {
    console.log(`Syncing ${user.displayName}'s sequences...`);

    for (const seq of user.sequences) {
      try {
        const publicData = {
          id: seq.id,
          sourceRef: `users/${user.userId}/sequences/${seq.id}`,
          ownerId: user.userId,
          ownerDisplayName: user.displayName,
          ownerAvatarUrl: user.avatarUrl || null,
          name: seq.data.name || seq.word,
          displayName: seq.data.displayName || null,
          word: seq.word,
          thumbnails: seq.data.thumbnails || [],
          sequenceLength: seq.stepsCount,
          difficultyLevel: seq.data.difficultyLevel || null,
          viewCount: seq.data.viewCount || 0,
          starCount: seq.data.starCount || 0,
          tags: [],
          isForked: seq.data.source === "forked",
          originalCreatorId: seq.data.forkAttribution?.originalCreatorId || null,
          originalCreatorName: seq.data.forkAttribution?.originalCreatorName || null,
          publishedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("publicSequences").doc(seq.id).set(publicData);
        totalSynced++;
        console.log(`  ✅ "${seq.word}"`);
      } catch (error) {
        console.log(`  ❌ Failed "${seq.word}": ${error.message}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Synced ${totalSynced}/${totalMissing} sequences`);
  console.log("✨ Migration complete!");
}

async function deleteEmptyStepsSequences(noSteps) {
  console.log(`\nDeleting ${noSteps.length} sequences with no steps...`);

  let deleted = 0;
  let failed = 0;

  for (const entry of noSteps) {
    try {
      await db.collection("publicSequences").doc(entry.id).delete();
      console.log(`✅ Deleted: "${entry.word}" (${entry.id})`);
      deleted++;
    } catch (error) {
      console.log(`❌ Failed to delete "${entry.word}": ${error.message}`);
      failed++;
    }
  }

  return { deleted, failed };
}

async function main() {
  const shouldDelete = process.argv.includes("--delete");
  const cleanEmpty = process.argv.includes("--clean-empty");
  const checkUser = process.argv.find(a => a.startsWith("--user="));
  const syncAll = process.argv.includes("--sync-all");

  if (syncAll) {
    await syncAllMissingPublicSequences();
    process.exit(0);
  }

  if (checkUser) {
    const userId = checkUser.split("=")[1];
    const shouldSync = process.argv.includes("--sync");
    await checkUserSequences(userId, userId, shouldSync);
    process.exit(0);
  }

  try {
    const { orphans, valid, noSteps } = await findOrphanedPublicSequences();

    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Valid entries:    ${valid.length}`);
    console.log(`With steps:       ${valid.filter(v => v.hasSteps).length}`);
    console.log(`WITHOUT steps:    ${noSteps.length}`);
    console.log(`Orphaned entries: ${orphans.length}`);

    if (orphans.length === 0 && noSteps.length === 0) {
      console.log("\n✨ No orphaned entries found!");
      process.exit(0);
    }

    // Handle --clean-empty flag to remove sequences with no steps
    if (cleanEmpty && noSteps.length > 0) {
      console.log("\n⚠️  Sequences with no steps:");
      for (const entry of noSteps) {
        console.log(`  - "${entry.word}" by ${entry.ownerDisplayName}`);
      }

      const { deleted, failed } = await deleteEmptyStepsSequences(noSteps);
      console.log("\n" + "=".repeat(60));
      console.log(`Deleted empty: ${deleted}, Failed: ${failed}`);
      process.exit(0);
    }

    if (orphans.length === 0) {
      console.log("\n✨ No orphaned entries found!");
      if (noSteps.length > 0) {
        console.log(`\n⚠️  ${noSteps.length} sequences have no steps.`);
        console.log("Run with --clean-empty to remove them from public index.");
      }
      process.exit(0);
    }

    // Group by owner
    const byOwner = {};
    for (const orphan of orphans) {
      const key = orphan.ownerDisplayName || orphan.ownerId || "Unknown";
      if (!byOwner[key]) byOwner[key] = [];
      byOwner[key].push(orphan);
    }

    console.log("\nOrphans by creator:");
    for (const [owner, items] of Object.entries(byOwner)) {
      console.log(`  ${owner}: ${items.length} sequences`);
      for (const item of items) {
        console.log(`    - "${item.word}" (${item.reason})`);
      }
    }

    if (shouldDelete) {
      const { deleted, failed } = await deleteOrphans(orphans);
      console.log("\n" + "=".repeat(60));
      console.log(`Deleted: ${deleted}, Failed: ${failed}`);
    } else {
      console.log("\n⚠️  DRY RUN - no changes made");
      console.log("Run with --delete to remove orphaned entries");
    }

    process.exit(0);
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

main();
