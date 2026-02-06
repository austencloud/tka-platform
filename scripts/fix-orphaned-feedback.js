/**
 * Fix Orphaned Feedback Items
 *
 * Updates feedback items that should belong to Austen but have incorrect userIds
 * OR are missing userPhotoURL (which causes "?" avatars)
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import config from "../config/feedback.config.js";

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Use admin user from config
const CORRECT_USER = {
  userId: config.ADMIN_USER.userId,
  userDisplayName: config.ADMIN_USER.displayName,
  userEmail: config.ADMIN_USER.email,
  userPhotoURL: config.ADMIN_USER.photoURL,
};

async function fixOrphanedFeedback() {
  console.log("Scanning feedback collection for orphaned items...\n");

  const snapshot = await db.collection("feedback").get();
  const batch = db.batch();
  let orphanedCount = 0;
  let missingPhotoCount = 0;
  const fixedItems = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const userId = data.userId || "";
    const userName = (
      data.userDisplayName ||
      data.userName ||
      ""
    ).toLowerCase();
    const userEmail = (data.userEmail || "").toLowerCase();

    // Check if it looks like Austen's feedback but wrong userId
    const looksLikeAusten =
      userName.includes("austen") ||
      userEmail.includes("austencloud") ||
      userId === "claude-agent" ||
      userId === "austen-cloud";

    const isCorrectUserId = userId === CORRECT_USER.userId;
    const hasPhotoURL = Boolean(data.userPhotoURL);
    const hasFacebookUrl =
      data.userPhotoURL && data.userPhotoURL.includes("facebook.com");
    const hasCorrectPhotoURL = data.userPhotoURL === CORRECT_USER.userPhotoURL;

    // Case 1: Wrong userId entirely
    if (looksLikeAusten && !isCorrectUserId) {
      batch.update(doc.ref, {
        userId: CORRECT_USER.userId,
        userDisplayName: CORRECT_USER.userDisplayName,
        userEmail: CORRECT_USER.userEmail,
        userPhotoURL: CORRECT_USER.userPhotoURL,
        userName: CORRECT_USER.userDisplayName,
      });
      orphanedCount++;
      fixedItems.push({
        id: doc.id,
        reason: `wrong userId: ${userId}`,
        title: (data.title || "").substring(0, 50),
      });
    }
    // Case 2: Correct userId but missing/wrong userPhotoURL (including Facebook URLs)
    else if (
      isCorrectUserId &&
      (!hasPhotoURL || hasFacebookUrl || !hasCorrectPhotoURL)
    ) {
      batch.update(doc.ref, {
        userPhotoURL: CORRECT_USER.userPhotoURL,
        userDisplayName: CORRECT_USER.userDisplayName,
        userEmail: CORRECT_USER.userEmail,
      });
      missingPhotoCount++;
      const reason = hasFacebookUrl
        ? "Facebook URL"
        : !hasPhotoURL
          ? "missing userPhotoURL"
          : "wrong userPhotoURL";
      fixedItems.push({
        id: doc.id,
        reason,
        title: (data.title || "").substring(0, 50),
      });
    }
  });

  const totalCount = orphanedCount + missingPhotoCount;

  if (totalCount > 0) {
    await batch.commit();
    console.log(`✅ Fixed ${totalCount} feedback items\n`);
    console.log(`   - ${orphanedCount} with wrong userId`);
    console.log(`   - ${missingPhotoCount} with missing/wrong userPhotoURL\n`);
    console.log(`   All now linked to userId: ${CORRECT_USER.userId}`);
    console.log(`   With photoURL: ${CORRECT_USER.userPhotoURL}\n`);
    console.log("Fixed items:");
    fixedItems.forEach((item) => {
      console.log(`  - [${item.reason}] ${item.title} (${item.id})`);
    });
  } else {
    console.log("No items need fixing - all feedback properly configured!");
  }
}

fixOrphanedFeedback()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
