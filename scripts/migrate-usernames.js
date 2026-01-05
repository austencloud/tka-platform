/**
 * Username Migration Script
 *
 * Backfills the /usernames collection from existing user documents
 * and adds usernameLowercase field to all user docs.
 *
 * Usage: node scripts/migrate-usernames.js [--dry-run] [--fix-duplicates]
 *
 * Options:
 *   --dry-run         Preview changes without writing to Firestore
 *   --fix-duplicates  Auto-suffix duplicate usernames instead of just reporting
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const PAGE_SIZE = 100;
const DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a unique username by appending a random suffix
 */
function generateSuffixedUsername(base, existingUsernames) {
  let attempts = 0;
  while (attempts < 100) {
    const suffix = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    const candidate = `${base}_${suffix}`;
    const candidateLower = candidate.toLowerCase();

    if (!existingUsernames.has(candidateLower)) {
      return candidate;
    }
    attempts++;
  }

  // Fallback: use timestamp
  const timestamp = Date.now().toString(36);
  return `${base}_${timestamp}`;
}

/**
 * Format username to lowercase for comparison
 */
function formatUsername(username) {
  return username?.toLowerCase().trim() || "";
}

async function migrateUsernames(dryRun = false, fixDuplicates = false) {
  console.log(`\n🔄 Username Migration${dryRun ? " (DRY RUN)" : ""}\n`);

  if (fixDuplicates) {
    console.log("⚠️  Fix duplicates mode enabled - will auto-rename duplicates\n");
  }

  const stats = {
    totalUsers: 0,
    withUsername: 0,
    withoutUsername: 0,
    usernamesCreated: 0,
    usernameLowercaseAdded: 0,
    duplicatesFound: 0,
    duplicatesFixed: 0,
    errors: 0,
  };

  // Track all usernames we've seen (lowercase -> {userId, displayName, username})
  const usernameMap = new Map();
  const duplicates = [];
  const usersToUpdate = [];

  // Phase 1: Collect all users and identify duplicates
  console.log("📖 Phase 1: Reading all users...\n");

  let lastDoc = null;
  let pageNum = 0;

  while (true) {
    pageNum++;

    let query = db
      .collection("users")
      .orderBy("__name__")
      .limit(PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      stats.totalUsers++;
      const data = doc.data();
      const userId = doc.id;
      const username = data.username;
      const displayName = data.displayName || data.email?.split("@")[0] || "Unknown";

      if (!username) {
        stats.withoutUsername++;
        // Generate a username for users without one
        const baseUsername = data.email?.split("@")[0] || userId.substring(0, 8);
        usersToUpdate.push({
          userId,
          displayName,
          needsUsername: true,
          baseUsername,
        });
        continue;
      }

      stats.withUsername++;
      const usernameLower = formatUsername(username);

      // Check for duplicate
      if (usernameMap.has(usernameLower)) {
        stats.duplicatesFound++;
        const existing = usernameMap.get(usernameLower);
        duplicates.push({
          username,
          usernameLower,
          users: [
            { userId: existing.userId, displayName: existing.displayName },
            { userId, displayName },
          ],
        });

        // Mark for update if we're fixing duplicates
        if (fixDuplicates) {
          usersToUpdate.push({
            userId,
            displayName,
            username,
            needsNewUsername: true,
            baseUsername: username,
          });
        }
      } else {
        usernameMap.set(usernameLower, { userId, displayName, username });

        // Check if usernameLowercase field is missing
        if (!data.usernameLowercase) {
          usersToUpdate.push({
            userId,
            displayName,
            username,
            needsLowercaseField: true,
          });
        }
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.docs.length < PAGE_SIZE) {
      break;
    }

    await sleep(DELAY_MS);
  }

  console.log(`   Found ${stats.totalUsers} users`);
  console.log(`   ${stats.withUsername} have usernames`);
  console.log(`   ${stats.withoutUsername} missing usernames`);
  console.log(`   ${stats.duplicatesFound} duplicate usernames found\n`);

  // Report duplicates
  if (duplicates.length > 0) {
    console.log("⚠️  Duplicate Usernames:\n");
    for (const dup of duplicates) {
      console.log(`   "${dup.username}" is used by:`);
      for (const user of dup.users) {
        console.log(`     - ${user.displayName} (${user.userId})`);
      }
      console.log();
    }
  }

  if (dryRun) {
    console.log("📊 Dry Run Summary\n");
    console.log(`   Users needing updates: ${usersToUpdate.length}`);
    console.log(`   Usernames to create in /usernames: ${usernameMap.size}`);
    console.log(`   Duplicates to resolve: ${duplicates.length}`);
    console.log("\n⚠️  Dry run complete. No changes were made.");
    console.log("Run without --dry-run to apply changes.\n");
    return;
  }

  // Phase 2: Create /usernames collection entries
  console.log("📝 Phase 2: Creating /usernames collection entries...\n");

  let batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;

  for (const [usernameLower, data] of usernameMap) {
    const usernameDocRef = db.collection("usernames").doc(usernameLower);

    batch.set(usernameDocRef, {
      userId: data.userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batchCount++;
    stats.usernamesCreated++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   Committed ${stats.usernamesCreated} username entries...`);
      batch = db.batch();
      batchCount = 0;
      await sleep(DELAY_MS);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`   Committed ${stats.usernamesCreated} username entries total\n`);
  }

  // Phase 3: Update user documents
  console.log("📝 Phase 3: Updating user documents...\n");

  // Collect all claimed usernames for generating unique ones
  const claimedUsernames = new Set(usernameMap.keys());

  batch = db.batch();
  batchCount = 0;

  for (const user of usersToUpdate) {
    const userDocRef = db.collection("users").doc(user.userId);
    const updateData = {};

    if (user.needsUsername) {
      // Generate new username for user without one
      const newUsername = generateSuffixedUsername(user.baseUsername, claimedUsernames);
      const newUsernameLower = formatUsername(newUsername);

      updateData.username = newUsername;
      updateData.usernameLowercase = newUsernameLower;

      // Also create /usernames entry
      const usernameDocRef = db.collection("usernames").doc(newUsernameLower);
      batch.set(usernameDocRef, {
        userId: user.userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      claimedUsernames.add(newUsernameLower);
      stats.usernamesCreated++;

      console.log(`   Generated username "${newUsername}" for ${user.displayName}`);
    } else if (user.needsNewUsername && fixDuplicates) {
      // Generate new username for duplicate
      const newUsername = generateSuffixedUsername(user.baseUsername, claimedUsernames);
      const newUsernameLower = formatUsername(newUsername);

      updateData.username = newUsername;
      updateData.usernameLowercase = newUsernameLower;

      // Create /usernames entry for new username
      const usernameDocRef = db.collection("usernames").doc(newUsernameLower);
      batch.set(usernameDocRef, {
        userId: user.userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      claimedUsernames.add(newUsernameLower);
      stats.usernamesCreated++;
      stats.duplicatesFixed++;

      console.log(`   Renamed "${user.username}" -> "${newUsername}" for ${user.displayName}`);
    } else if (user.needsLowercaseField) {
      // Just add the lowercase field
      updateData.usernameLowercase = formatUsername(user.username);
      stats.usernameLowercaseAdded++;
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      batch.update(userDocRef, updateData);
      batchCount++;
    }

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   Committed batch of ${batchCount} user updates...`);
      batch = db.batch();
      batchCount = 0;
      await sleep(DELAY_MS);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`   Committed final batch of ${batchCount} user updates\n`);
  }

  // Print final results
  console.log("\n📊 Migration Results\n");
  console.log(`Total users:              ${stats.totalUsers}`);
  console.log(`With existing username:   ${stats.withUsername}`);
  console.log(`Without username:         ${stats.withoutUsername}`);
  console.log(`/usernames entries created: ${stats.usernamesCreated}`);
  console.log(`usernameLowercase added:  ${stats.usernameLowercaseAdded}`);
  console.log(`Duplicates found:         ${stats.duplicatesFound}`);
  console.log(`Duplicates fixed:         ${stats.duplicatesFixed}`);
  console.log(`Errors:                   ${stats.errors}`);

  if (stats.duplicatesFound > 0 && !fixDuplicates) {
    console.log("\n⚠️  Duplicates were found but not fixed.");
    console.log("Run with --fix-duplicates to auto-rename duplicate usernames.\n");
  }

  console.log("\n✅ Migration complete!\n");
}

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fixDuplicates = args.includes("--fix-duplicates");

migrateUsernames(dryRun, fixDuplicates)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
