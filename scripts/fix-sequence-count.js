#!/usr/bin/env node
/**
 * Fix sequenceCount for users where the denormalized counter has drifted.
 * Recalculates the actual count from the user's sequences subcollection.
 *
 * Usage:
 *   node scripts/fix-sequence-count.js                          # Dry run (all users with count < 0)
 *   node scripts/fix-sequence-count.js --user rabinowitzkevin   # Dry run for specific user
 *   node scripts/fix-sequence-count.js --all                    # Dry run for ALL users
 *   node scripts/fix-sequence-count.js --confirm                # Actually fix
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIRM = process.argv.includes("--confirm");
const CHECK_ALL = process.argv.includes("--all");
const userFilter = (() => {
  const idx = process.argv.indexOf("--user");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

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

async function getActualSequenceCount(userId) {
  const sequencesRef = db.collection(`users/${userId}/sequences`);
  const snapshot = await sequencesRef.count().get();
  return snapshot.data().count;
}

async function fixUser(userId, userData) {
  const storedCount = userData.sequenceCount ?? 0;
  const actualCount = await getActualSequenceCount(userId);

  if (storedCount === actualCount) {
    return null;
  }

  const displayName = userData.displayName ?? userData.username ?? userId;
  console.log(
    `  ${displayName} (@${userData.username ?? "?"}): stored=${storedCount}, actual=${actualCount}`
  );

  if (CONFIRM) {
    await db.doc(`users/${userId}`).update({ sequenceCount: actualCount });
    console.log(`    -> Fixed to ${actualCount}`);
  }

  return { userId, displayName, storedCount, actualCount };
}

async function main() {
  console.log(CONFIRM ? "FIXING sequence counts...\n" : "DRY RUN (add --confirm to apply)\n");

  let usersQuery;

  if (userFilter) {
    // Find by username
    usersQuery = db.collection("users").where("username", "==", userFilter);
  } else if (CHECK_ALL) {
    usersQuery = db.collection("users");
  } else {
    // Default: only users with negative counts
    usersQuery = db.collection("users").where("sequenceCount", "<", 0);
  }

  const snapshot = await usersQuery.get();

  if (snapshot.empty) {
    console.log("No users found matching criteria.");
    process.exit(0);
  }

  console.log(`Checking ${snapshot.size} user(s)...\n`);

  const mismatches = [];
  for (const doc of snapshot.docs) {
    const result = await fixUser(doc.id, doc.data());
    if (result) mismatches.push(result);
  }

  console.log(`\n${mismatches.length} mismatched count(s) found.`);
  if (!CONFIRM && mismatches.length > 0) {
    console.log("Run with --confirm to apply fixes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
