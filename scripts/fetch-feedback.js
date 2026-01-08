/**
 * Feedback Queue Manager
 *
 * Run `node scripts/fetch-feedback.js help` to see all available commands.
 *
 * Workflow:
 *   1. Agent runs with no args → claims next unclaimed feedback (prioritized: no priority > high > medium > low)
 *   2. If complex, agent adds subtasks to break it down
 *   3. Future agents see subtasks and can work on prerequisites first
 *   4. Agent resolves when all subtasks complete
 *   5. When moving to in-review/completed, add resolution notes to explain what was done
 *
 * Concurrency Safety:
 *   - Claims use Firestore transactions to prevent race conditions
 *   - Two agents running simultaneously cannot claim the same item
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import config from "../config/feedback.config.js";

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Import config values
const { ADMIN_USER_ID, ADMIN_USER, STALE_CLAIM_MS } = config;

/**
 * Generate a deterministic conversation ID from two user IDs
 */
function generateConversationId(userId1, userId2) {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

/**
 * Send a direct message to a user (in their conversation with admin)
 * This mirrors the message they receive when submitting feedback
 *
 * Includes deduplication: won't send if already notified for same status
 */
async function sendDirectMessageToUser(
  userId,
  feedbackId,
  feedbackTitle,
  feedbackStatus,
  messageContent
) {
  if (!userId) {
    console.log("  ⚠️  No userId - skipping message");
    return null;
  }

  // Don't send messages to yourself
  if (userId === ADMIN_USER_ID) {
    console.log("  ℹ️  Skipping message to admin (self)");
    return null;
  }

  // Check for duplicate notification
  try {
    const feedbackRef = db.collection("feedback").doc(feedbackId);
    const feedbackDoc = await feedbackRef.get();
    if (feedbackDoc.exists) {
      const data = feedbackDoc.data();
      // Skip if already notified for this status
      if (data.lastNotifiedStatus === feedbackStatus) {
        console.log(`  ℹ️  Already notified for status "${feedbackStatus}" - skipping`);
        return null;
      }
    }
  } catch (e) {
    // Continue even if check fails
  }

  try {
    const conversationId = generateConversationId(ADMIN_USER_ID, userId);
    const conversationRef = db.collection("conversations").doc(conversationId);
    const conversationSnap = await conversationRef.get();

    // Get or create conversation
    if (!conversationSnap.exists) {
      // Fetch user info
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userDisplayName = userData.displayName || userData.username || "User";
      const userPhotoURL = userData.photoURL || null;

      // Create new conversation
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

    // Create the message with feedback attachment
    const messagesRef = conversationRef.collection("messages");
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
            feedbackStatus,
          },
        },
      ],
      isDeleted: false,
      replyTo: null,
      reactions: null,
      editHistory: null,
    };

    const messageRef = await messagesRef.add(messageData);

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

    // Update notification tracking to prevent duplicates
    try {
      await db.collection("feedback").doc(feedbackId).update({
        lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastNotifiedStatus: feedbackStatus,
      });
    } catch (e) {
      // Non-critical - continue even if tracking update fails
    }

    console.log(`  💬 Direct message sent to user`);
    return messageRef.id;
  } catch (error) {
    console.error("  ⚠️  Failed to send direct message:", error.message);
    return null;
  }
}

/**
 * Send notification to user when their feedback is resolved/completed
 */
async function notifyUserFeedbackResolved(
  userId,
  feedbackId,
  feedbackTitle,
  message
) {
  if (!userId) {
    console.log("  ⚠️  No userId - skipping notification");
    return null;
  }

  try {
    const notificationRef = db
      .collection("users")
      .doc(userId)
      .collection("notifications");

    const notification = {
      userId,
      type: "feedback-resolved",
      feedbackId,
      feedbackTitle: feedbackTitle || "Your feedback",
      message: message || "Your feedback has been addressed! Check it out.",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
      fromUserId: "system",
      fromUserName: "TKA Scribe",
    };

    const docRef = await notificationRef.add(notification);
    console.log(`  📬 Notification sent to user`);
    return docRef.id;
  } catch (error) {
    console.error("  ⚠️  Failed to send notification:", error.message);
    return null;
  }
}

/**
 * Download images from Firebase Storage for a feedback item
 * Returns array of local file paths
 */
async function downloadFeedbackImages(feedbackId, imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    return [];
  }

  // Ensure feedback-images directory exists
  const imageDir = "./feedback-images";
  if (!existsSync(imageDir)) {
    mkdirSync(imageDir);
  }

  const downloadedPaths = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const filename = `feedback-${feedbackId}-${i + 1}.png`;
    const filepath = `${imageDir}/${filename}`;

    try {
      // Use curl with --ssl-no-revoke to handle certificate issues
      execSync(`curl --ssl-no-revoke -s -o "${filepath}" "${url}"`, {
        stdio: "pipe",
      });
      downloadedPaths.push(filepath);
    } catch (error) {
      console.error(
        `  ⚠️  Failed to download image ${i + 1}: ${error.message}`
      );
    }
  }

  return downloadedPaths;
}

/**
 * Atomically claim a feedback item using Firestore transaction
 * Prevents race conditions when multiple agents try to claim simultaneously
 *
 * @param {string} docId - The document ID to claim
 * @param {boolean} isReclaim - Whether this is reclaiming a stale item
 * @returns {Object|null} - The claimed item data, or null if claim failed
 */
async function atomicClaim(docId, isReclaim = false) {
  try {
    const docRef = db.collection("feedback").doc(docId);

    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error("Item no longer exists");
      }

      const data = doc.data();

      // Check if still claimable
      if (data.status === "in-progress" && !isReclaim) {
        // Another agent claimed it between our query and this transaction
        throw new Error("Already claimed by another agent");
      }

      // For reclaims, verify it's still stale
      if (isReclaim && data.status === "in-progress") {
        const claimAge = data.claimedAt?.toDate?.()
          ? Date.now() - data.claimedAt.toDate().getTime()
          : 0;
        if (claimAge < STALE_CLAIM_MS) {
          throw new Error("Item is no longer stale");
        }
      }

      // If status changed to completed/archived, don't claim
      if (["completed", "archived"].includes(data.status)) {
        throw new Error("Item is no longer claimable");
      }

      // Perform atomic update
      transaction.update(docRef, {
        status: "in-progress",
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        claimedBy: ADMIN_USER_ID, // Track who claimed it
      });

      return { id: doc.id, ...data };
    });

    return result;
  } catch (error) {
    if (
      error.message.includes("Already claimed") ||
      error.message.includes("no longer")
    ) {
      console.log(`  ⚠️  ${error.message}`);
      return null;
    }
    throw error;
  }
}

/**
 * List all feedback with queue status summary
 */
async function listAllFeedback() {
  console.log("\n📋 Feedback Queue Status\n");
  console.log("=".repeat(70));

  try {
    const snapshot = await db
      .collection("feedback")
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      console.log("\n  No feedback found in the database.\n");
      return;
    }

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Count by status (4 kanban columns)
    const counts = { new: 0, "in-progress": 0, "in-review": 0, archived: 0 };
    items.forEach((item) => {
      const status = item.status || "new";
      // Map legacy statuses to current ones
      if (status === "resolved" || status === "deferred") {
        counts.archived++;
      } else if (counts.hasOwnProperty(status)) {
        counts[status]++;
      } else {
        counts.new++; // Fallback for unknown statuses
      }
    });

    console.log(
      `\n  Queue: ${counts.new} new | ${counts["in-progress"]} in progress | ${counts["in-review"]} in review | ${counts.archived} archived\n`
    );
    console.log("─".repeat(70));

    // Show unclaimed (new) items first
    const newItems = items.filter((i) => i.status === "new" || !i.status);
    const inProgressItems = items.filter((i) => i.status === "in-progress");
    const inReviewItems = items.filter((i) => i.status === "in-review");
    const archivedItems = items.filter(
      (i) =>
        i.status === "archived" ||
        i.status === "resolved" ||
        i.status === "deferred"
    );

    if (newItems.length > 0) {
      console.log("\n  🆕 UNCLAIMED (ready to work on):\n");
      newItems.forEach((item, idx) => {
        const title = (item.title || "No title").substring(0, 50);
        console.log(
          `     ${item.id.substring(0, 8)}... | ${item.type || "N/A"} | ${title}${item.title?.length > 50 ? "..." : ""}`
        );
      });
    }

    if (inProgressItems.length > 0) {
      console.log("\n  🔄 IN PROGRESS (being worked on):\n");
      inProgressItems.forEach((item) => {
        const title = (item.title || "No title").substring(0, 50);
        const claimedAt = item.claimedAt?.toDate?.()
          ? item.claimedAt.toDate().toLocaleString()
          : "Unknown";
        const isStale =
          item.claimedAt?.toDate?.() &&
          Date.now() - item.claimedAt.toDate().getTime() > STALE_CLAIM_MS;
        console.log(
          `     ${item.id.substring(0, 8)}... | ${item.type || "N/A"} | ${title}${item.title?.length > 50 ? "..." : ""}`
        );
        console.log(
          `       └─ Claimed: ${claimedAt}${isStale ? " ⚠️ STALE" : ""}`
        );
      });
    }

    if (inReviewItems.length > 0) {
      console.log("\n  👁️ IN REVIEW (awaiting tester confirmation):\n");
      inReviewItems.forEach((item) => {
        const title = (item.title || "No title").substring(0, 50);
        console.log(
          `     ${item.id.substring(0, 8)}... | ${item.type || "N/A"} | ${title}${item.title?.length > 50 ? "..." : ""}`
        );
      });
    }

    if (archivedItems.length > 0) {
      console.log("\n  📦 ARCHIVED:\n");
      archivedItems.slice(0, 5).forEach((item) => {
        const title = (item.title || "No title").substring(0, 50);
        const note = item.resolutionNotes
          ? ` - ${item.resolutionNotes.substring(0, 30)}${item.resolutionNotes.length > 30 ? "..." : ""}`
          : "";
        console.log(
          `     ${item.id.substring(0, 8)}... | ${item.type || "N/A"} | ${title}${item.title?.length > 50 ? "..." : ""}${note}`
        );
      });
      if (archivedItems.length > 5) {
        console.log(`     ... and ${archivedItems.length - 5} more`);
      }
    }

    console.log("\n" + "=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n  Error listing feedback:", error.message);
    throw error;
  }
}

/**
 * Claim the next available feedback item
 * Returns the item details for the agent to work on
 * @param {string|null} priorityFilter - Optional priority to filter by ('low', 'medium', 'high')
 */
async function claimNextFeedback(priorityFilter = null) {
  try {
    // First check if there's a stale in-progress item we should reclaim
    // (only if not filtering by priority)
    let itemToClaim = null;
    let isReclaim = false;

    if (!priorityFilter) {
      const staleSnapshot = await db
        .collection("feedback")
        .where("status", "==", "in-progress")
        .get();

      for (const doc of staleSnapshot.docs) {
        const data = doc.data();
        if (data.claimedAt?.toDate?.()) {
          const claimAge = Date.now() - data.claimedAt.toDate().getTime();
          if (claimAge > STALE_CLAIM_MS) {
            itemToClaim = { id: doc.id, ...data };
            isReclaim = true;
            break;
          }
        }
      }
    }

    // If no stale items, get the highest priority "new" item
    // Priority order: no priority first (needs triage), then high, medium, low
    // Within same priority, oldest first
    if (!itemToClaim) {
      const newSnapshot = await db
        .collection("feedback")
        .where("status", "==", "new")
        .get();

      if (!newSnapshot.empty) {
        let items = newSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter by priority if specified
        if (priorityFilter) {
          items = items.filter((item) => item.priority === priorityFilter);
          if (items.length === 0) {
            console.log("\n" + "=".repeat(70));
            console.log(
              `\n  ✨ No ${priorityFilter.toUpperCase()} priority items in queue!\n`
            );
            console.log(
              "  Run `node scripts/fetch-feedback.js.js list` to see all items."
            );
            console.log("\n" + "=".repeat(70) + "\n");
            return null;
          }
        }

        // Sort by priority order, then by createdAt
        const priorityOrder = { "": 0, high: 1, medium: 2, low: 3 };
        const sortedItems = items.sort((a, b) => {
          const priorityA = priorityOrder[a.priority || ""] ?? 4;
          const priorityB = priorityOrder[b.priority || ""] ?? 4;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          // Within same priority, oldest first
          const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
          const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
          return timeA - timeB;
        });

        if (sortedItems.length > 0) {
          itemToClaim = sortedItems[0];
        }
      } else if (!priorityFilter) {
        // Also check items with no status field (legacy) - only when not filtering
        const legacySnapshot = await db
          .collection("feedback")
          .orderBy("createdAt", "asc")
          .get();

        const legacyItem = legacySnapshot.docs.find((doc) => {
          const data = doc.data();
          return !data.status || data.status === "new";
        });

        if (legacyItem) {
          itemToClaim = { id: legacyItem.id, ...legacyItem.data() };
        }
      }
    }

    // If no new items, fall back to in-progress items (resume work)
    if (!itemToClaim && !priorityFilter) {
      const inProgressSnapshot = await db
        .collection("feedback")
        .where("status", "==", "in-progress")
        .get();

      if (!inProgressSnapshot.empty) {
        // Sort by claimedAt (oldest first) to resume oldest work
        const inProgressItems = inProgressSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const timeA = a.claimedAt?.toDate?.()?.getTime() || 0;
            const timeB = b.claimedAt?.toDate?.()?.getTime() || 0;
            return timeA - timeB;
          });

        if (inProgressItems.length > 0) {
          itemToClaim = inProgressItems[0];
          isReclaim = true; // Mark as resuming existing work
        }
      }
    }

    if (!itemToClaim) {
      console.log("\n" + "=".repeat(70));
      console.log(
        "\n  ✨ QUEUE EMPTY - No unclaimed or in-progress feedback items!\n"
      );
      console.log(
        "  Run `node scripts/fetch-feedback.js.js list` to see all items."
      );
      console.log("\n" + "=".repeat(70) + "\n");
      return null;
    }

    // Claim the item atomically (prevents race conditions)
    const claimedItem = await atomicClaim(itemToClaim.id, isReclaim);

    if (!claimedItem) {
      // Claim failed (item was claimed by another agent)
      console.log("\n  🔄 Retrying with next available item...\n");
      // Recursively try the next item
      return claimNextFeedback(priorityFilter);
    }

    // Use the transaction-verified data
    itemToClaim = claimedItem;

    // Output the claimed item details
    const createdAt = itemToClaim.createdAt?.toDate?.()
      ? itemToClaim.createdAt.toDate().toLocaleString()
      : "Unknown date";

    console.log("\n" + "=".repeat(70));
    const headerText = isReclaim ? "🔄 RESUMING IN-PROGRESS" : "🎯 CLAIMED";
    console.log(`\n  ${headerText} FEEDBACK\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${itemToClaim.id}`);
    console.log(`  Type: ${itemToClaim.type || "N/A"}`);
    console.log(`  Priority: ${itemToClaim.priority || "N/A"}`);
    console.log(
      `  User: ${itemToClaim.userDisplayName || itemToClaim.userEmail || "Anonymous"}`
    );
    console.log(`  Created: ${createdAt}`);
    console.log("─".repeat(70));
    console.log(`  Title: ${itemToClaim.title || "No title"}`);
    console.log("─".repeat(70));
    console.log(`  Description:\n`);
    console.log(`  ${itemToClaim.description || "No description"}`);
    console.log("─".repeat(70));
    console.log(`  Module: ${itemToClaim.capturedModule || "Unknown"}`);
    console.log(`  Tab: ${itemToClaim.capturedTab || "Unknown"}`);
    if (itemToClaim.resolutionNotes) {
      console.log("─".repeat(70));
      console.log(`  Previous Notes: ${itemToClaim.resolutionNotes}`);
    }

    // Show subtasks if they exist
    if (itemToClaim.subtasks?.length > 0) {
      console.log("─".repeat(70));
      const completed = itemToClaim.subtasks.filter(
        (s) => s.status === "completed"
      ).length;
      console.log(
        `  📋 SUBTASKS (${completed}/${itemToClaim.subtasks.length} completed):\n`
      );
      itemToClaim.subtasks.forEach((s) => {
        const statusIcon =
          s.status === "completed"
            ? "✅"
            : s.status === "in-progress"
              ? "🔄"
              : "⬚";
        const deps =
          s.dependsOn?.length > 0
            ? ` (depends: ${s.dependsOn.join(", ")})`
            : "";
        console.log(`     ${statusIcon} #${s.id} ${s.title}${deps}`);
      });

      // Find next available subtask (pending, with all dependencies completed)
      const nextSubtask = itemToClaim.subtasks.find((s) => {
        if (s.status !== "pending") return false;
        if (!s.dependsOn?.length) return true;
        return s.dependsOn.every((depId) => {
          const dep = itemToClaim.subtasks.find((d) => d.id === depId);
          return dep?.status === "completed";
        });
      });

      if (nextSubtask) {
        console.log(
          `\n  ➡️ Next subtask: #${nextSubtask.id} ${nextSubtask.title}`
        );
      }
    }

    // Download and display images if they exist
    if (itemToClaim.imageUrls && itemToClaim.imageUrls.length > 0) {
      console.log("─".repeat(70));
      console.log(`  📸 IMAGES (${itemToClaim.imageUrls.length}):\n`);

      const downloadedPaths = await downloadFeedbackImages(
        itemToClaim.id,
        itemToClaim.imageUrls
      );

      if (downloadedPaths.length > 0) {
        downloadedPaths.forEach((path, idx) => {
          console.log(`     [${idx + 1}] Downloaded to: ${path}`);
        });
        console.log(
          `\n  ✅ Images ready to view - use the Read tool on the paths above`
        );
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log(
      `\n  To resolve: node scripts/fetch-feedback.js.js ${itemToClaim.id} in-review "Your notes here"\n`
    );

    return itemToClaim;
  } catch (error) {
    console.error("\n  Error claiming feedback:", error.message);
    throw error;
  }
}

/**
 * Update feedback title by Firestore document ID
 */
async function updateFeedbackTitle(docId, title) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    await docRef.update({
      title: title,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ TITLE UPDATED\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docId}`);
    console.log(`  New Title: ${title}`);
    console.log("\n" + "=".repeat(70) + "\n");

    return { id: docId, title };
  } catch (error) {
    console.error("\n  Error updating title:", error.message);
    throw error;
  }
}

/**
 * Update resolution notes
 */
async function updateResolutionNotes(docId, notes) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    await docRef.update({
      resolutionNotes: notes,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const item = doc.data();
    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ RESOLUTION NOTES UPDATED\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docId}`);
    console.log(`  Title: ${item.title || "No title"}`);
    console.log(`  Resolution Notes: ${notes}`);
    console.log("\n" + "=".repeat(70) + "\n");

    return { id: docId, resolutionNotes: notes };
  } catch (error) {
    console.error("\n  Error updating resolution notes:", error.message);
    throw error;
  }
}

/**
 * Update feedback status by Firestore document ID
 * @param {string} docId - The document ID to update
 * @param {string} status - The new status
 * @param {string} resolutionNotes - Admin-only resolution notes
 * @param {string} userFacingNotes - Optional user-visible notes (for notifying submitter)
 */
async function updateFeedbackById(docId, status, resolutionNotes, userFacingNotes = null) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    // Map common status aliases to correct format (4 valid statuses)
    const statusMap = {
      in_progress: "in-progress",
      in_review: "in-review",
      inprogress: "in-progress",
      inreview: "in-review",
      resolved: "archived", // resolved is now archived
      deferred: "archived", // deferred is now archived (use resolutionNotes to explain)
    };
    const normalizedStatus = statusMap[status] || status;

    // Validate status is one of the 5 valid values
    const validStatuses = [
      "new",
      "in-progress",
      "in-review",
      "completed",
      "archived",
    ];
    if (!validStatuses.includes(normalizedStatus)) {
      console.log(
        `\n  ⚠️ Invalid status "${status}". Valid: ${validStatuses.join(", ")}\n`
      );
      return null;
    }

    const updateData = {
      status: normalizedStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Clear claimedAt when archiving, completing, or moving to review
    if (["archived", "completed", "in-review"].includes(normalizedStatus)) {
      updateData.claimedAt = admin.firestore.FieldValue.delete();
    }
    if (normalizedStatus === "archived") {
      updateData.resolvedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    if (resolutionNotes) {
      updateData.adminNotes = resolutionNotes;
    }

    // Add user-facing notes if provided
    if (userFacingNotes) {
      updateData.userFacingNotes = userFacingNotes;
    }

    await docRef.update(updateData);

    const item = doc.data();
    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ FEEDBACK UPDATED\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docId}`);
    console.log(`  Title: ${item.title || "No title"}`);
    console.log(`  New Status: ${normalizedStatus}`);
    if (resolutionNotes) {
      console.log(`  Admin Notes: ${resolutionNotes}`);
    }
    if (userFacingNotes) {
      console.log(`  User Notes: ${userFacingNotes}`);
    }

    // Send direct message to user when marking as completed or archived
    if (["completed", "archived"].includes(normalizedStatus) && item.userId) {
      console.log("─".repeat(70));

      let messageContent;
      if (normalizedStatus === "completed") {
        // Prefer user-facing notes for the message, fall back to resolution notes
        const userMessage = userFacingNotes || resolutionNotes;
        messageContent = userMessage
          ? `Your feedback has been addressed: ${userMessage}`
          : "Your feedback has been addressed and is ready for the next release!";
      } else if (normalizedStatus === "archived") {
        // Check if there's a version tag
        const version = item.fixedInVersion || null;
        if (version) {
          messageContent = `Your feedback was included in version ${version}! Thank you for helping improve TKA Scribe.`;
        } else {
          const userMessage = userFacingNotes || resolutionNotes;
          messageContent = userMessage
            ? `Your feedback has been resolved: ${userMessage}`
            : "Your feedback has been resolved. Thank you for your input!";
        }
      }

      await sendDirectMessageToUser(
        item.userId,
        docId,
        item.title,
        normalizedStatus,
        messageContent
      );
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return { id: docId, ...item };
  } catch (error) {
    console.error("\n  Error updating feedback:", error.message);
    throw error;
  }
}

/**
 * Add a subtask to a feedback item
 */
async function addSubtask(docId, title, description, dependsOn = []) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    const item = doc.data();
    const subtasks = item.subtasks || [];

    // Generate a simple numeric ID
    const newId = String(subtasks.length + 1);

    const newSubtask = {
      id: newId,
      title,
      description,
      status: "pending",
    };

    // Only add dependsOn if there are dependencies
    if (dependsOn.length > 0) {
      newSubtask.dependsOn = dependsOn;
    }

    subtasks.push(newSubtask);

    await docRef.update({
      subtasks,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ SUBTASK ADDED\n`);
    console.log("─".repeat(70));
    console.log(`  Feedback: ${item.title || docId}`);
    console.log(`  Subtask #${newId}: ${title}`);
    if (dependsOn.length > 0) {
      console.log(`  Depends on: ${dependsOn.join(", ")}`);
    }
    console.log("\n" + "=".repeat(70) + "\n");

    return newSubtask;
  } catch (error) {
    console.error("\n  Error adding subtask:", error.message);
    throw error;
  }
}

/**
 * Update subtask status
 */
async function updateSubtaskStatus(docId, subtaskId, status) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    const item = doc.data();
    const subtasks = item.subtasks || [];

    const subtaskIndex = subtasks.findIndex((s) => s.id === subtaskId);
    if (subtaskIndex === -1) {
      console.log(`\n  ❌ Subtask not found: ${subtaskId}\n`);
      return null;
    }

    const validStatuses = ["pending", "in-progress", "completed"];
    if (!validStatuses.includes(status)) {
      console.log(
        `\n  ⚠️ Invalid subtask status. Valid: ${validStatuses.join(", ")}\n`
      );
      return null;
    }

    subtasks[subtaskIndex].status = status;
    if (status === "completed") {
      subtasks[subtaskIndex].completedAt = new Date();
    }

    await docRef.update({
      subtasks,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Show progress
    const completed = subtasks.filter((s) => s.status === "completed").length;
    const total = subtasks.length;

    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ SUBTASK UPDATED\n`);
    console.log("─".repeat(70));
    console.log(`  Feedback: ${item.title || docId}`);
    console.log(`  Subtask #${subtaskId}: ${subtasks[subtaskIndex].title}`);
    console.log(`  New Status: ${status}`);
    console.log(`  Progress: ${completed}/${total} subtasks completed`);
    console.log("\n" + "=".repeat(70) + "\n");

    return subtasks[subtaskIndex];
  } catch (error) {
    console.error("\n  Error updating subtask:", error.message);
    throw error;
  }
}

/**
 * List subtasks for a feedback item
 */
async function listSubtasks(docId) {
  try {
    const doc = await db.collection("feedback").doc(docId).get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    const item = { id: doc.id, ...doc.data() };
    const subtasks = item.subtasks || [];

    console.log("\n" + "=".repeat(70));
    console.log(`\n  📋 SUBTASKS for: ${item.title || docId}\n`);
    console.log("─".repeat(70));

    if (subtasks.length === 0) {
      console.log("  No subtasks defined.\n");
    } else {
      const completed = subtasks.filter((s) => s.status === "completed").length;
      console.log(`  Progress: ${completed}/${subtasks.length} completed\n`);

      subtasks.forEach((s) => {
        const statusIcon =
          s.status === "completed"
            ? "✅"
            : s.status === "in-progress"
              ? "🔄"
              : "⬚";
        const deps =
          s.dependsOn?.length > 0
            ? ` (depends: ${s.dependsOn.join(", ")})`
            : "";
        console.log(`  ${statusIcon} #${s.id} ${s.title}${deps}`);
        console.log(
          `     ${s.description.substring(0, 70)}${s.description.length > 70 ? "..." : ""}`
        );
      });
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return subtasks;
  } catch (error) {
    console.error("\n  Error listing subtasks:", error.message);
    throw error;
  }
}

/**
 * Delete a feedback item
 */
async function deleteFeedback(docId) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    const item = doc.data();
    await docRef.delete();

    console.log("\n" + "=".repeat(70));
    console.log(`\n  🗑️ FEEDBACK DELETED\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docId}`);
    console.log(`  Title: ${item.title || "No title"}`);
    console.log("\n" + "=".repeat(70) + "\n");

    return { id: docId, deleted: true };
  } catch (error) {
    console.error("\n  Error deleting feedback:", error.message);
    throw error;
  }
}

/**
 * Get feedback by Firestore document ID
 */
async function getFeedbackById(docId) {
  try {
    const doc = await db.collection("feedback").doc(docId).get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    const item = { id: doc.id, ...doc.data() };
    const createdAt = item.createdAt?.toDate?.()
      ? item.createdAt.toDate().toLocaleString()
      : "Unknown date";

    console.log("\n" + "=".repeat(70));
    console.log(`\n  FEEDBACK DETAILS\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${item.id}`);
    console.log(`  Type: ${item.type || "N/A"}`);
    console.log(`  Status: ${item.status || "new"}`);
    console.log(`  Priority: ${item.priority || "N/A"}`);
    console.log(
      `  User: ${item.userDisplayName || item.userEmail || "Anonymous"}`
    );
    console.log(`  Created: ${createdAt}`);
    console.log("─".repeat(70));
    console.log(`  Title: ${item.title || "No title"}`);
    console.log("─".repeat(70));
    console.log(`  Description:\n`);
    console.log(`  ${item.description || "No description"}`);
    console.log("─".repeat(70));
    console.log(`  Module: ${item.capturedModule || "Unknown"}`);
    console.log(`  Tab: ${item.capturedTab || "Unknown"}`);
    if (item.resolutionNotes) {
      console.log("─".repeat(70));
      console.log(`  Resolution: ${item.resolutionNotes}`);
    }

    // Show subtasks if they exist
    if (item.subtasks?.length > 0) {
      console.log("─".repeat(70));
      const completed = item.subtasks.filter(
        (s) => s.status === "completed"
      ).length;
      console.log(
        `  📋 SUBTASKS (${completed}/${item.subtasks.length} completed):\n`
      );
      item.subtasks.forEach((s) => {
        const statusIcon =
          s.status === "completed"
            ? "✅"
            : s.status === "in-progress"
              ? "🔄"
              : "⬚";
        const deps =
          s.dependsOn?.length > 0
            ? ` (depends: ${s.dependsOn.join(", ")})`
            : "";
        console.log(`     ${statusIcon} #${s.id} ${s.title}${deps}`);
        console.log(
          `        ${s.description.substring(0, 60)}${s.description.length > 60 ? "..." : ""}`
        );
      });
    }

    // Download and display images if they exist
    if (item.imageUrls && item.imageUrls.length > 0) {
      console.log("─".repeat(70));
      console.log(`  📸 IMAGES (${item.imageUrls.length}):\n`);

      const downloadedPaths = await downloadFeedbackImages(
        item.id,
        item.imageUrls
      );

      if (downloadedPaths.length > 0) {
        downloadedPaths.forEach((path, idx) => {
          console.log(`     [${idx + 1}] Downloaded to: ${path}`);
        });
        console.log(
          `\n  ✅ Images ready to view - use the Read tool on the paths above`
        );
      }
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return item;
  } catch (error) {
    console.error("\n  Error fetching feedback:", error.message);
    throw error;
  }
}

/**
 * Defer feedback until a specific date
 */
async function deferFeedback(docId, deferUntilDate, reason) {
  try {
    const feedbackRef = db.collection("feedback").doc(docId);
    const doc = await feedbackRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback item ${docId} not found.\n`);
      return;
    }

    // Parse date (YYYY-MM-DD format)
    const parsedDate = new Date(deferUntilDate);
    if (isNaN(parsedDate.getTime())) {
      console.log(
        `\n  ❌ Invalid date format. Use YYYY-MM-DD (e.g., 2026-03-15)\n`
      );
      return;
    }

    // Set to end of day
    parsedDate.setHours(23, 59, 59, 999);

    await feedbackRef.update({
      status: "archived",
      deferredUntil: admin.firestore.Timestamp.fromDate(parsedDate),
      resolutionNotes: reason || `Deferred until ${deferUntilDate}`,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("\n" + "=".repeat(70));
    console.log(`\n  ⏰ DEFERRED until ${deferUntilDate}`);
    console.log(`\n  Item: ${docId}`);
    console.log(`  Reason: ${reason || "No reason provided"}`);
    console.log(`\n  📌 This item will auto-reactivate on ${deferUntilDate}`);
    console.log(`     Run 'node scripts/reactivate-deferred.js' manually`);
    console.log(`     or wait for daily cron job to run.`);
    console.log("\n" + "=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n  Error deferring feedback:", error.message);
    throw error;
  }
}

/**
 * Update feedback priority
 */
async function updateFeedbackPriority(docId, priority) {
  const validPriorities = ["low", "medium", "high"];
  if (!validPriorities.includes(priority)) {
    console.log(
      `\n  ⚠️ Invalid priority "${priority}". Valid: ${validPriorities.join(", ")}\n`
    );
    return null;
  }

  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    await docRef.update({
      priority: priority,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const item = doc.data();
    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ PRIORITY UPDATED\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docId}`);
    console.log(`  Title: ${item.title || "No title"}`);
    console.log(`  Priority: ${priority.toUpperCase()}`);
    console.log("\n" + "=".repeat(70) + "\n");

    return { id: docId, priority };
  } catch (error) {
    console.error("\n  Error updating priority:", error.message);
    throw error;
  }
}

/**
 * Auto-prioritize feedback items based on type and description keywords
 * Priority rules:
 * - HIGH: bugs, crashes, data loss, security, blocking issues, "can't", "broken", "error"
 * - MEDIUM: core features, important UX issues, "should", "need", "want"
 * - LOW: polish, cosmetic, nice-to-haves, "could", "maybe", "minor"
 *
 * With --json flag: outputs raw JSON for AI analysis instead of auto-assigning
 */
async function prioritizeFeedback(dryRun = false, jsonOutput = false) {
  try {
    // Fetch all "new" items without a priority
    const snapshot = await db
      .collection("feedback")
      .where("status", "==", "new")
      .get();

    const unprioritized = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => !item.priority);

    if (unprioritized.length === 0) {
      if (jsonOutput) {
        console.log(
          JSON.stringify({
            items: [],
            message: "All feedback items already have priorities",
          })
        );
      } else {
        console.log("\n" + "=".repeat(70));
        console.log("\n  ✨ All feedback items already have priorities!\n");
        console.log("=".repeat(70) + "\n");
      }
      return;
    }

    // JSON output mode - just dump the raw data for AI analysis
    if (jsonOutput) {
      const items = unprioritized.map((item) => ({
        id: item.id,
        type: item.type || "general",
        title: item.title || null,
        description: item.description || item.content || null,
        module: item.module || null,
        tab: item.tab || null,
        userName: item.userName || null,
        createdAt: item.createdAt?._seconds
          ? new Date(item.createdAt._seconds * 1000).toISOString()
          : null,
      }));
      console.log(JSON.stringify({ items, count: items.length }, null, 2));
      return;
    }

    console.log("\n" + "=".repeat(70));
    console.log(
      `\n  🎯 AUTO-PRIORITIZING ${unprioritized.length} FEEDBACK ITEMS\n`
    );
    console.log("─".repeat(70));

    // Keywords for priority detection
    const highKeywords = [
      "crash",
      "broken",
      "error",
      "bug",
      "fail",
      "can't",
      "cannot",
      "doesn't work",
      "won't",
      "stuck",
      "freeze",
      "hang",
      "data loss",
      "security",
      "blocking",
      "urgent",
      "critical",
      "severe",
      "major",
      "unusable",
      "impossible",
    ];
    const lowKeywords = [
      "could",
      "maybe",
      "minor",
      "small",
      "cosmetic",
      "polish",
      "nice to have",
      "nitpick",
      "suggestion",
      "idea",
      "would be nice",
      "eventually",
      "someday",
      "tweak",
      "slightly",
      "little",
    ];

    const results = { high: [], medium: [], low: [] };

    for (const item of unprioritized) {
      const text =
        `${item.description || ""} ${item.title || ""}`.toLowerCase();
      const type = item.type || "general";

      let priority = "medium"; // Default

      // Type-based priority
      if (type === "bug") {
        priority = "high"; // Bugs start as high
      }

      // Keyword overrides
      const hasHighKeyword = highKeywords.some((kw) => text.includes(kw));
      const hasLowKeyword = lowKeywords.some((kw) => text.includes(kw));

      if (hasHighKeyword) {
        priority = "high";
      } else if (hasLowKeyword && type !== "bug") {
        priority = "low";
      }

      // Feature requests without urgency keywords are medium
      if (type === "feature" && !hasHighKeyword && !hasLowKeyword) {
        priority = "medium";
      }

      // Enhancements are typically medium-low
      if (type === "enhancement" && !hasHighKeyword) {
        priority = hasLowKeyword ? "low" : "medium";
      }

      // General feedback without keywords is low
      if (type === "general" && !hasHighKeyword) {
        priority = "low";
      }

      results[priority].push(item);

      const title = (
        item.title ||
        item.description?.substring(0, 40) ||
        "Untitled"
      ).substring(0, 45);
      const icon =
        priority === "high" ? "🔴" : priority === "medium" ? "🟡" : "🟢";
      console.log(
        `  ${icon} ${priority.toUpperCase().padEnd(6)} | ${item.type?.padEnd(11) || "general    "} | ${title}${title.length >= 45 ? "..." : ""}`
      );

      if (!dryRun) {
        await db.collection("feedback").doc(item.id).update({
          priority,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    console.log("\n" + "─".repeat(70));
    console.log(
      `\n  Summary: ${results.high.length} high | ${results.medium.length} medium | ${results.low.length} low`
    );

    if (dryRun) {
      console.log(
        "\n  ⚠️  DRY RUN - No changes made. Run without --dry-run to apply."
      );
    } else {
      console.log("\n  ✅ All items prioritized!");
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return results;
  } catch (error) {
    console.error("\n  Error prioritizing feedback:", error.message);
    throw error;
  }
}

/**
 * Mark feedback as internal-only (excluded from user-facing changelog)
 */
async function setInternalOnly(docId, isInternalOnly) {
  try {
    const feedbackRef = db.collection("feedback").doc(docId);
    const doc = await feedbackRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback item ${docId} not found.\n`);
      return;
    }

    const value = isInternalOnly === "true" || isInternalOnly === true;

    await feedbackRef.update({
      isInternalOnly: value,
    });

    const item = doc.data();
    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ UPDATED`);
    console.log(`\n  Item: ${item.title || docId}`);
    console.log(
      `  Internal Only: ${value ? "YES (excluded from user changelog)" : "NO (included in user changelog)"}`
    );
    console.log("\n" + "=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n  Error updating feedback:", error.message);
    throw error;
  }
}

/**
 * Show help documentation
 */
function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                        FEEDBACK QUEUE MANAGER                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

QUEUE COMMANDS
──────────────────────────────────────────────────────────────────────────────
  (no args)              Auto-claim next "new" item (by priority)
  low | medium | high    Claim next item with specific priority only
  claim <id>             Claim a specific item by ID
  unclaim <id>           Release a claimed item back to "new" status
  list                   List all feedback grouped by status
  stats                  Show queue statistics summary
  search <query>         Search feedback by keyword in title/description

ITEM MANAGEMENT
──────────────────────────────────────────────────────────────────────────────
  <id>                   View specific feedback details
  <id> <status> "notes"  Update status (new, in-progress, in-review, completed, archived)
  <id> <status> "admin notes" --user-notes "user message"
                         Update status with both admin and user-facing notes
  <id> title "text"      Update title
  <id> priority <p>      Update priority (low, medium, high)
  <id> resolution "text" Add resolution notes (what was done)
  <id> internal-only <t> Mark as internal (true) or user-facing (false)
  <id> defer "YYYY-MM-DD" "reason"  Defer until date
  delete <id>            Permanently delete feedback item

SUBTASKS
──────────────────────────────────────────────────────────────────────────────
  <id> subtask list                     List all subtasks
  <id> subtask add "title" "desc"       Add a subtask
  <id> subtask <subId> <status>         Update subtask status

CREATE FEEDBACK
──────────────────────────────────────────────────────────────────────────────
  add --title "T" --description "D" [options]
  create "title" "description" [type] [module] [tab]

  Options for 'add':
    --title "text"        Required: Title of the feedback
    --description "text"  Required: Description
    --type <type>         bug, feature, enhancement, general (default: enhancement)
    --priority <p>        low, medium, high
    --module <name>       Module name (e.g., compose, create)
    --tab <name>          Tab name
    --internal-only       Mark as internal (not user-facing)
    --user <name>         User identifier (default: austen)

AUTO-PRIORITIZE
──────────────────────────────────────────────────────────────────────────────
  prioritize             Auto-assign priorities to unprioritized items
  prioritize --dry-run   Preview without making changes
  prioritize --json      Output raw JSON for AI analysis

WORKFLOW
──────────────────────────────────────────────────────────────────────────────
  1. Run with no args to claim next item → status becomes "in-progress"
  2. Work on the item, optionally breaking into subtasks
  3. Move to "in-review" when done: <id> in-review "Fixed by doing X"
  4. Admin marks "completed" after testing: <id> completed "Verified"
  5. Release batches completed items → "archived" with version tag

EXAMPLES
──────────────────────────────────────────────────────────────────────────────
  node scripts/fetch-feedback.js.js                     # Claim next item
  node scripts/fetch-feedback.js.js high                # Claim next high-priority
  node scripts/fetch-feedback.js.js abc123              # View item abc123
  node scripts/fetch-feedback.js.js abc123 in-review "Fixed overflow bug"
  node scripts/fetch-feedback.js.js search "button"     # Find feedback about buttons
  node scripts/fetch-feedback.js.js stats               # See queue overview
  node scripts/fetch-feedback.js.js add --title "Fix X" --description "Details" --type bug
`);
}

/**
 * Unclaim a feedback item (release back to queue)
 */
async function unclaimFeedback(docId) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    const item = doc.data();
    if (item.status !== "in-progress") {
      console.log(
        `\n  ⚠️  Item is not in-progress (current: ${item.status}). Cannot unclaim.\n`
      );
      return null;
    }

    await docRef.update({
      status: "new",
      claimedAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("\n" + "=".repeat(70));
    console.log(`\n  🔓 FEEDBACK UNCLAIMED\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docId}`);
    console.log(`  Title: ${item.title || "No title"}`);
    console.log(`  Status: new (back in queue)`);
    console.log("\n" + "=".repeat(70) + "\n");

    return { id: docId, status: "new" };
  } catch (error) {
    console.error("\n  Error unclaiming feedback:", error.message);
    throw error;
  }
}

/**
 * Claim a specific feedback item by ID
 */
async function claimSpecificFeedback(docId) {
  try {
    const docRef = db.collection("feedback").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Feedback not found: ${docId}\n`);
      return null;
    }

    const item = doc.data();

    // Check if already claimed
    if (item.status === "in-progress") {
      const claimedAt = item.claimedAt?.toDate?.()
        ? item.claimedAt.toDate().toLocaleString()
        : "Unknown";
      console.log(`\n  ⚠️  Item already in-progress (claimed: ${claimedAt})`);
      console.log(
        `  Use 'unclaim ${docId}' first if you want to reclaim it.\n`
      );
      return null;
    }

    // Check if in terminal state
    if (["completed", "archived"].includes(item.status)) {
      console.log(
        `\n  ⚠️  Item is ${item.status}. Cannot claim completed/archived items.\n`
      );
      return null;
    }

    await docRef.update({
      status: "in-progress",
      claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Output the claimed item details (reuse display logic)
    const createdAt = item.createdAt?.toDate?.()
      ? item.createdAt.toDate().toLocaleString()
      : "Unknown date";

    console.log("\n" + "=".repeat(70));
    console.log(`\n  🎯 CLAIMED FEEDBACK\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docId}`);
    console.log(`  Type: ${item.type || "N/A"}`);
    console.log(`  Priority: ${item.priority || "N/A"}`);
    console.log(
      `  User: ${item.userDisplayName || item.userEmail || "Anonymous"}`
    );
    console.log(`  Created: ${createdAt}`);
    console.log("─".repeat(70));
    console.log(`  Title: ${item.title || "No title"}`);
    console.log("─".repeat(70));
    console.log(`  Description:\n`);
    console.log(`  ${item.description || "No description"}`);
    console.log("─".repeat(70));
    console.log(`  Module: ${item.capturedModule || "Unknown"}`);
    console.log(`  Tab: ${item.capturedTab || "Unknown"}`);

    if (item.resolutionNotes) {
      console.log("─".repeat(70));
      console.log(`  Previous Notes: ${item.resolutionNotes}`);
    }

    console.log("\n" + "=".repeat(70));
    console.log(
      `\n  To resolve: node scripts/fetch-feedback.js ${docId} in-review "Your resolution notes"\n`
    );

    return { id: docId, ...item };
  } catch (error) {
    console.error("\n  Error claiming feedback:", error.message);
    throw error;
  }
}

/**
 * Search feedback by keyword
 */
async function searchFeedback(query) {
  try {
    const snapshot = await db
      .collection("feedback")
      .orderBy("createdAt", "desc")
      .get();

    if (snapshot.empty) {
      console.log("\n  No feedback found in the database.\n");
      return [];
    }

    const queryLower = query.toLowerCase();
    const matches = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => {
        const title = (item.title || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const resolution = (item.resolutionNotes || "").toLowerCase();
        const module = (item.capturedModule || "").toLowerCase();
        return (
          title.includes(queryLower) ||
          desc.includes(queryLower) ||
          resolution.includes(queryLower) ||
          module.includes(queryLower)
        );
      });

    console.log("\n" + "=".repeat(70));
    console.log(`\n  🔍 SEARCH RESULTS for "${query}"\n`);
    console.log("─".repeat(70));

    if (matches.length === 0) {
      console.log(`  No feedback found matching "${query}"\n`);
    } else {
      console.log(`  Found ${matches.length} item(s):\n`);

      matches.forEach((item) => {
        const statusIcon =
          {
            new: "🆕",
            "in-progress": "🔄",
            "in-review": "👁️",
            completed: "✅",
            archived: "📦",
          }[item.status] || "❓";

        const priorityIcon =
          {
            high: "🔴",
            medium: "🟡",
            low: "🟢",
          }[item.priority] || "⚪";

        const title = (item.title || "No title").substring(0, 50);
        console.log(
          `  ${statusIcon} ${priorityIcon} ${item.id.substring(0, 8)}... | ${title}${item.title?.length > 50 ? "..." : ""}`
        );
      });
    }

    console.log("\n" + "=".repeat(70) + "\n");
    return matches;
  } catch (error) {
    console.error("\n  Error searching feedback:", error.message);
    throw error;
  }
}

/**
 * Show queue statistics
 */
async function showStats() {
  try {
    const snapshot = await db.collection("feedback").get();

    if (snapshot.empty) {
      console.log("\n  No feedback in the database.\n");
      return;
    }

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Count by status
    const byStatus = {
      new: 0,
      "in-progress": 0,
      "in-review": 0,
      completed: 0,
      archived: 0,
    };
    items.forEach((item) => {
      const status = item.status || "new";
      if (byStatus.hasOwnProperty(status)) {
        byStatus[status]++;
      } else if (["resolved", "deferred"].includes(status)) {
        byStatus.archived++;
      } else {
        byStatus.new++;
      }
    });

    // Count by type
    const byType = {};
    items.forEach((item) => {
      const type = item.type || "general";
      byType[type] = (byType[type] || 0) + 1;
    });

    // Count by priority (only non-archived)
    const activeItems = items.filter(
      (i) =>
        !["completed", "archived", "resolved", "deferred"].includes(i.status)
    );
    const byPriority = { high: 0, medium: 0, low: 0, unset: 0 };
    activeItems.forEach((item) => {
      const priority = item.priority || "unset";
      if (byPriority.hasOwnProperty(priority)) {
        byPriority[priority]++;
      } else {
        byPriority.unset++;
      }
    });

    // Find stale items
    const staleItems = items.filter((item) => {
      if (item.status !== "in-progress") return false;
      if (!item.claimedAt?.toDate?.()) return false;
      return Date.now() - item.claimedAt.toDate().getTime() > STALE_CLAIM_MS;
    });

    console.log("\n" + "=".repeat(70));
    console.log(`\n  📊 FEEDBACK QUEUE STATISTICS\n`);
    console.log("─".repeat(70));

    console.log(`\n  BY STATUS:`);
    console.log(`    🆕 New:          ${byStatus.new.toString().padStart(3)}`);
    console.log(
      `    🔄 In Progress:  ${byStatus["in-progress"].toString().padStart(3)}${staleItems.length > 0 ? ` (${staleItems.length} stale)` : ""}`
    );
    console.log(
      `    👁️  In Review:    ${byStatus["in-review"].toString().padStart(3)}`
    );
    console.log(
      `    ✅ Completed:    ${byStatus.completed.toString().padStart(3)}`
    );
    console.log(
      `    📦 Archived:     ${byStatus.archived.toString().padStart(3)}`
    );
    console.log(`    ─────────────────────`);
    console.log(`    📝 Total:        ${items.length.toString().padStart(3)}`);

    console.log(`\n  BY TYPE:`);
    Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`    ${type.padEnd(12)} ${count.toString().padStart(3)}`);
      });

    console.log(`\n  ACTIVE BY PRIORITY:`);
    console.log(`    🔴 High:     ${byPriority.high.toString().padStart(3)}`);
    console.log(`    🟡 Medium:   ${byPriority.medium.toString().padStart(3)}`);
    console.log(`    🟢 Low:      ${byPriority.low.toString().padStart(3)}`);
    if (byPriority.unset > 0) {
      console.log(
        `    ⚪ Unset:    ${byPriority.unset.toString().padStart(3)}  ← run 'prioritize' to assign`
      );
    }

    // Actionable summary
    console.log("\n" + "─".repeat(70));
    const actionable = byStatus.new + byStatus["in-review"];
    if (actionable > 0) {
      console.log(
        `\n  📌 ${actionable} item(s) need attention (${byStatus.new} new, ${byStatus["in-review"]} awaiting review)`
      );
    }
    if (byStatus.completed > 0) {
      console.log(`  🚀 ${byStatus.completed} item(s) ready for release`);
    }
    if (staleItems.length > 0) {
      console.log(
        `  ⚠️  ${staleItems.length} stale in-progress item(s) (claimed >2h ago)`
      );
    }

    console.log("\n" + "=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n  Error fetching stats:", error.message);
    throw error;
  }
}

/**
 * Add feedback with flag-based syntax
 */
async function addFeedback(args) {
  // Parse flags
  const flags = {};
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const flag = args[i].substring(2);
      if (flag === "internal-only") {
        flags.isInternalOnly = true;
        i++;
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[flag] = args[i + 1];
        i += 2;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  // Validate required fields
  if (!flags.title) {
    console.log("\n  ❌ Missing required --title\n");
    console.log(
      '  Usage: node scripts/fetch-feedback.js.js add --title "Title" --description "Desc" [options]'
    );
    console.log(
      "  Options: --type, --priority, --module, --tab, --internal-only, --user\n"
    );
    return null;
  }

  if (!flags.description) {
    console.log("\n  ❌ Missing required --description\n");
    return null;
  }

  // Validate type
  const validTypes = ["bug", "feature", "enhancement", "general"];
  const type = flags.type || "enhancement";
  if (!validTypes.includes(type)) {
    console.log(
      `\n  ⚠️  Invalid type "${type}". Valid: ${validTypes.join(", ")}\n`
    );
    return null;
  }

  // Validate priority if provided
  const validPriorities = ["low", "medium", "high"];
  if (flags.priority && !validPriorities.includes(flags.priority)) {
    console.log(
      `\n  ⚠️  Invalid priority "${flags.priority}". Valid: ${validPriorities.join(", ")}\n`
    );
    return null;
  }

  // Use admin user from config
  const feedbackData = {
    title: flags.title,
    description: flags.description,
    type,
    status: "new",
    source: "terminal", // Created via CLI, not app feedback form
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    userId: ADMIN_USER.userId,
    userDisplayName: ADMIN_USER.displayName,
    userEmail: ADMIN_USER.email,
    userPhotoURL: ADMIN_USER.photoURL,
  };

  if (flags.priority) {
    feedbackData.priority = flags.priority;
  }
  if (flags.module) {
    feedbackData.capturedModule = flags.module;
  }
  if (flags.tab) {
    feedbackData.capturedTab = flags.tab;
  }
  if (flags.isInternalOnly) {
    feedbackData.isInternalOnly = true;
  }

  try {
    const docRef = await db.collection("feedback").add(feedbackData);

    console.log("\n" + "=".repeat(70));
    console.log(`\n  ✅ FEEDBACK CREATED\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${docRef.id}`);
    console.log(`  Title: ${flags.title}`);
    console.log(`  Type: ${type}`);
    if (flags.priority) console.log(`  Priority: ${flags.priority}`);
    if (flags.module) console.log(`  Module: ${flags.module}`);
    if (flags.tab) console.log(`  Tab: ${flags.tab}`);
    if (flags.isInternalOnly) console.log(`  Internal Only: YES`);
    console.log("\n" + "=".repeat(70) + "\n");

    return { id: docRef.id, ...feedbackData };
  } catch (error) {
    console.error("\n  Error creating feedback:", error.message);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

async function main() {
  const validPriorities = ["low", "medium", "high"];

  if (args.length === 0) {
    // No args: claim next item
    await claimNextFeedback();
  } else if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    // Show help
    showHelp();
  } else if (validPriorities.includes(args[0])) {
    // Priority filter: claim next item with specified priority
    await claimNextFeedback(args[0]);
  } else if (args[0] === "list") {
    // List all feedback
    await listAllFeedback();
  } else if (args[0] === "stats") {
    // Show queue statistics
    await showStats();
  } else if (args[0] === "search") {
    // Search: search <query>
    if (!args[1]) {
      console.log(
        "\n  Usage: node scripts/fetch-feedback.js.js search <query>\n"
      );
      console.log(
        '  Example: node scripts/fetch-feedback.js.js search "button"\n'
      );
      return;
    }
    await searchFeedback(args.slice(1).join(" "));
  } else if (args[0] === "claim") {
    // Claim specific: claim <id>
    if (!args[1]) {
      console.log("\n  Usage: node scripts/fetch-feedback.js.js claim <id>\n");
      return;
    }
    await claimSpecificFeedback(args[1]);
  } else if (args[0] === "unclaim") {
    // Unclaim: unclaim <id>
    if (!args[1]) {
      console.log(
        "\n  Usage: node scripts/fetch-feedback.js.js unclaim <id>\n"
      );
      return;
    }
    await unclaimFeedback(args[1]);
  } else if (args[0] === "add") {
    // Add with flags: add --title "X" --description "Y" [options]
    await addFeedback(args.slice(1));
  } else if (args[0] === "delete") {
    // Delete: delete <id>
    if (!args[1]) {
      console.log("\n  Usage: node scripts/fetch-feedback.js.js delete <id>\n");
      return;
    }
    await deleteFeedback(args[1]);
  } else if (args[0] === "prioritize") {
    // Auto-prioritize all unprioritized feedback
    const dryRun = args.includes("--dry-run");
    const jsonOutput = args.includes("--json");
    await prioritizeFeedback(dryRun, jsonOutput);
  } else if (args[0] === "create") {
    // Create new feedback: create "title" "description" [type] [module] [tab]
    const title = args[1];
    const description = args[2];
    const type = args[3] || "enhancement";
    const module = args[4] || "Unknown";
    const tab = args[5] || "Unknown";

    if (!title || !description) {
      console.log(
        '\n  Usage: node scripts/fetch-feedback.js.js create "title" "description" [type] [module] [tab]'
      );
      console.log("  Types: bug, feature, enhancement, general");
      console.log(
        '  Example: node scripts/fetch-feedback.js.js create "Fix trail jank" "Trails appear janky..." enhancement compose playback\n'
      );
      return;
    }

    // Use admin user from config
    const docRef = await db.collection("feedback").add({
      title,
      description: description,
      type,
      capturedModule: module,
      capturedTab: tab,
      status: "new",
      source: "terminal", // Created via CLI, not app feedback form
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: ADMIN_USER.userId,
      userDisplayName: ADMIN_USER.displayName,
      userEmail: ADMIN_USER.email,
      userPhotoURL: ADMIN_USER.photoURL,
    });

    console.log(
      "\n======================================================================"
    );
    console.log("\n  ✅ FEEDBACK CREATED\n");
    console.log(
      "──────────────────────────────────────────────────────────────────────"
    );
    console.log(`  ID: ${docRef.id}`);
    console.log(`  Title: ${title}`);
    console.log(`  Type: ${type}`);
    console.log(`  Module: ${module} / ${tab}`);
    console.log(
      "\n======================================================================\n"
    );
  } else if (args[1] === "defer") {
    // Defer: <id> defer "YYYY-MM-DD" "Reason"
    if (!args[2]) {
      console.log(
        '\n  Usage: node scripts/fetch-feedback.js.js <id> defer "YYYY-MM-DD" "Reason"\n'
      );
      console.log(
        '  Example: node scripts/fetch-feedback.js.js abc123 defer "2026-03-15" "Revisit after Q1"\n'
      );
      return;
    }
    await deferFeedback(args[0], args[2], args[3]);
  } else if (args[1] === "internal-only") {
    // Internal-only: <id> internal-only true/false
    if (!args[2]) {
      console.log(
        "\n  Usage: node scripts/fetch-feedback.js.js <id> internal-only true/false\n"
      );
      console.log(
        "  Example: node scripts/fetch-feedback.js.js abc123 internal-only true\n"
      );
      return;
    }
    await setInternalOnly(args[0], args[2]);
  } else if (args[1] === "title") {
    // Update title: <id> title "new title"
    await updateFeedbackTitle(args[0], args[2]);
  } else if (args[1] === "priority") {
    // Update priority: <id> priority <low|medium|high>
    await updateFeedbackPriority(args[0], args[2]);
  } else if (args[1] === "resolution") {
    // Update resolution notes: <id> resolution "resolution notes"
    await updateResolutionNotes(args[0], args[2]);
  } else if (args[1] === "subtask") {
    // Subtask commands: <id> subtask <command> [args...]
    const docId = args[0];
    const subCommand = args[2];

    if (subCommand === "add") {
      // <id> subtask add "title" "description" [dependsOn...]
      const title = args[3];
      const description = args[4];
      const dependsOn = args.slice(5); // Remaining args are dependency IDs
      if (!title || !description) {
        console.log(
          '\n  Usage: node scripts/fetch-feedback.js.js <id> subtask add "title" "description" [dependsOn...]\n'
        );
        return;
      }
      await addSubtask(docId, title, description, dependsOn);
    } else if (subCommand === "list") {
      // <id> subtask list
      await listSubtasks(docId);
    } else if (subCommand) {
      // <id> subtask <subtaskId> <status>
      // e.g., <id> subtask 1 completed
      const subtaskId = subCommand;
      const status = args[3];
      if (!status) {
        console.log(
          "\n  Usage: node scripts/fetch-feedback.js.js <id> subtask <subtaskId> <status>\n"
        );
        console.log("  Valid statuses: pending, in-progress, completed\n");
        return;
      }
      await updateSubtaskStatus(docId, subtaskId, status);
    } else {
      console.log("\n  Subtask commands:");
      console.log('    <id> subtask add "title" "description" [dependsOn...]');
      console.log("    <id> subtask list");
      console.log("    <id> subtask <subtaskId> <status>\n");
    }
  } else if (args[1]) {
    // Update: <id> <status> ["notes"] [--user-notes "notes"]
    // Parse --user-notes flag if present
    const userNotesIndex = args.indexOf("--user-notes");
    let userFacingNotes = null;
    let resolutionNotes = args[2];

    if (userNotesIndex !== -1 && args[userNotesIndex + 1]) {
      userFacingNotes = args[userNotesIndex + 1];
      // If --user-notes comes before the resolution notes, adjust
      if (userNotesIndex === 2) {
        resolutionNotes = null;
      }
    }

    await updateFeedbackById(args[0], args[1], resolutionNotes, userFacingNotes);
  } else {
    // View specific item by ID
    await getFeedbackById(args[0]);
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
