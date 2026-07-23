/**
 * Archive completed feedback and create version record
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";
import config from "../config/feedback.config.js";

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Import config values
const { ADMIN_USER_ID, ADMIN_USER } = config;

/**
 * Generate a deterministic conversation ID from two user IDs
 */
function generateConversationId(userId1, userId2) {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

/**
 * Send a direct message to a user notifying them their feedback was released
 */
async function sendReleaseMessage(userId, feedbackId, feedbackTitle, version) {
  if (!userId || userId === ADMIN_USER_ID) {
    return null;
  }

  try {
    const conversationId = generateConversationId(ADMIN_USER_ID, userId);
    const conversationRef = db.collection("conversations").doc(conversationId);
    const conversationSnap = await conversationRef.get();

    // Get or create conversation
    if (!conversationSnap.exists) {
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userDisplayName = userData.displayName || userData.username || "User";
      const userPhotoURL = userData.photoURL || null;

      const participants = [ADMIN_USER_ID, userId].sort();
      const now = new Date();
      await conversationRef.set({
        participants,
        participantInfo: {
          [ADMIN_USER_ID]: {
            userId: ADMIN_USER_ID,
            displayName: ADMIN_USER.displayName,
            avatar: ADMIN_USER.photoURL,
            joinedAt: now,
          },
          [userId]: {
            userId,
            displayName: userDisplayName,
            ...(userPhotoURL && { avatar: userPhotoURL }),
            joinedAt: now,
          },
        },
        unreadCount: { [ADMIN_USER_ID]: 0, [userId]: 0 },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Create the message
    const messagesRef = conversationRef.collection("messages");
    const messageContent = `🚀 Your feedback was included in version ${version}! Thank you for helping improve Flow Arts Composer.`;

    const messageData = {
      senderId: ADMIN_USER_ID,
      senderName: ADMIN_USER.displayName,
      senderAvatar: ADMIN_USER.photoURL,
      content: messageContent,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      readBy: [ADMIN_USER_ID],
      attachments: [
        {
          type: "feedback",
          url: `/feedback/${feedbackId}`,
          metadata: {
            feedbackId,
            feedbackTitle: feedbackTitle || "Your feedback",
            feedbackStatus: "archived",
            fixedInVersion: version,
          },
        },
      ],
      isDeleted: false,
      replyTo: null,
      reactions: null,
      editHistory: null,
    };

    await messagesRef.add(messageData);

    // Update conversation metadata
    await conversationRef.update({
      lastMessage: {
        content: messageContent,
        senderId: ADMIN_USER_ID,
        senderName: ADMIN_USER.displayName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        hasAttachment: true,
      },
      [`unreadCount.${userId}`]: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error(`  ⚠️  Failed to message user ${userId}:`, error.message);
    return null;
  }
}

async function archiveFeedback() {
  const version = process.argv[2];

  if (!version) {
    console.error("Usage: node scripts/archive-feedback.js <version>");
    process.exit(1);
  }

  console.log(`📦 Archiving completed feedback for v${version}...\n`);

  const versionRef = db.collection("versions").doc(version);
  const existingVersion = await versionRef.get();
  if (existingVersion.exists) {
    throw new Error(
      `Version v${version} already exists. Refusing to overwrite its release notes.`
    );
  }

  // Get completed feedback
  const snapshot = await db
    .collection("feedback")
    .where("status", "==", "completed")
    .get();

  if (snapshot.empty) {
    console.log("No completed feedback to archive.");
    process.exit(0);
  }

  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  console.log(`Found ${items.length} completed items to archive:\n`);

  // Display items
  items.forEach((item) => {
    const typeEmoji =
      item.type === "bug" ? "🐛" : item.type === "feature" ? "✨" : "🔧";
    console.log(
      `  ${typeEmoji} ${item.title || item.description?.substring(0, 50) || "Untitled"}`
    );
  });

  // Calculate summary
  const summary = { bugs: 0, features: 0, general: 0 };
  items.forEach((item) => {
    if (item.type === "bug") summary.bugs++;
    else if (item.type === "feature") summary.features++;
    else summary.general++;
  });

  // Create changelog entries
  const changelogEntries = items.map((item) => {
    let category;
    switch (item.type) {
      case "bug":
        category = "fixed";
        break;
      case "feature":
        category = "added";
        break;
      default:
        category = "improved";
    }

    let text =
      item.title || item.description?.substring(0, 100) || "Untitled change";
    const lowerText = text.toLowerCase();

    if (category === "fixed" && !lowerText.startsWith("fixed")) {
      text = "Fixed " + text.charAt(0).toLowerCase() + text.slice(1);
    } else if (
      category === "added" &&
      !lowerText.startsWith("added") &&
      !lowerText.startsWith("new")
    ) {
      text = "Added " + text.charAt(0).toLowerCase() + text.slice(1);
    }

    return { category, text, feedbackId: item.id };
  });

  // Execute batch update
  const batch = db.batch();

  // Archive feedback items
  items.forEach((item) => {
    const ref = db.collection("feedback").doc(item.id);
    batch.update(ref, {
      fixedInVersion: version,
      status: "archived",
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // Create version document
  batch.set(versionRef, {
    version,
    feedbackCount: items.length,
    feedbackSummary: summary,
    changelogEntries,
    releasedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  console.log(`\n✓ Archived ${items.length} feedback items`);
  console.log(`✓ Created version record for v${version}`);
  console.log(
    `  (${summary.bugs} bugs, ${summary.features} features, ${summary.general} general)`
  );

  // Send messages to users who submitted feedback
  const usersToNotify = [...new Set(items.filter(i => i.userId).map(i => i.userId))];
  if (usersToNotify.length > 0) {
    console.log(`\n📬 Notifying ${usersToNotify.length} user(s) of release...`);

    let messaged = 0;
    for (const item of items) {
      if (item.userId && item.userId !== ADMIN_USER_ID) {
        const success = await sendReleaseMessage(
          item.userId,
          item.id,
          item.title,
          version
        );
        if (success) messaged++;
      }
    }

    console.log(`✓ Sent ${messaged} release notification(s)`);
  }
}

archiveFeedback().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
