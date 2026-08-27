/**
 * Museum Write Operations
 *
 * All mutation operations for museum development items:
 * - CRUD (create, update status)
 * - Session lifecycle (start, end, capture)
 * - Verdicts and answers
 * - Tags
 */

import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import config from "../../config/museum-dev.config.js";
import { db, admin, resolveAndValidateId, addJournalEntry, validateTransition } from "./museum-firebase.js";
import linking from "./museum-linking.js";

const {
  ADMIN_USER_ID,
  ITEM_TYPES,
  ELEMENT_SUBTYPES,
  VERDICT_TYPES,
  JOURNAL_TYPES,
  STATUSES,
  COLLECTIONS,
} = config;


/**
 * Create a new museum development item.
 */
export async function createItem(type, title, options = {}) {
  if (!ITEM_TYPES.includes(type)) {
    console.log(`\n  ❌ Invalid type: ${type}`);
    console.log(`     Valid types: ${ITEM_TYPES.join(", ")}\n`);
    return null;
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  const itemData = {
    type,
    title,
    description: options.description || "",
    status: "new",
    createdAt: now,
    updatedAt: now,
    linksTo: [],
    linkedFrom: [],
    attachments: [],
    tags: options.tags || [],
    relatedDocs: options.relatedDocs || [],
  };

  // Type-specific fields
  if (type === "session") {
    itemData.transcript = options.transcript || "";
    itemData.sessionDate = options.sessionDate || now;
    itemData.participants = options.participants || ["austen", "claude"];
  }

  if (type === "decision") {
    itemData.verdict = null;
    itemData.rationale = "";
  }

  if (type === "question") {
    itemData.answered = false;
    itemData.answer = "";
  }

  if (type === "proposal") {
    itemData.proposedBy = options.proposedBy || "claude";
    itemData.promotedToDecision = false;
  }

  if (type === "element" && options.elementType) {
    if (!ELEMENT_SUBTYPES.includes(options.elementType)) {
      console.log(`\n  ❌ Invalid element type: ${options.elementType}`);
      console.log(`     Valid types: ${ELEMENT_SUBTYPES.join(", ")}\n`);
      return null;
    }
    itemData.elementType = options.elementType;
    itemData.docPath = options.docPath || "";
  }

  try {
    const docRef = await db.collection(COLLECTIONS.ITEMS).add(itemData);

    await addJournalEntry(docRef.id, "created", `Created ${type}: ${title}`, { type });

    console.log(`\n  ✅ Created ${type}: ${title}`);
    console.log(`     ID: ${docRef.id}\n`);

    return docRef.id;
  } catch (error) {
    console.error(`\n  ❌ Failed to create item: ${error.message}\n`);
    return null;
  }
}

/**
 * Update item status with state machine validation.
 */
export async function updateItemStatus(docId, newStatus, notes = null) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return false;

  if (!STATUSES.includes(newStatus)) {
    console.log(`\n  ❌ Invalid status: ${newStatus}`);
    console.log(`     Valid statuses: ${STATUSES.join(", ")}\n`);
    return false;
  }

  try {
    const docRef = db.collection(COLLECTIONS.ITEMS).doc(fullId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Item not found: ${fullId}\n`);
      return false;
    }

    const currentStatus = doc.data().status || "new";
    const { valid, error } = validateTransition(currentStatus, newStatus);

    if (!valid) {
      console.log(`\n  ❌ ${error}\n`);
      return false;
    }

    const updateData = {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (notes) {
      updateData.adminNotes = notes;
    }

    if (newStatus === "archived") {
      updateData.archivedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Handle claiming for in-progress
    if (newStatus === "in-progress" && currentStatus === "new") {
      updateData.claimedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.claimedBy = ADMIN_USER_ID;
      updateData.claimToken = randomUUID();
      updateData.lastActivity = admin.firestore.FieldValue.serverTimestamp();
    }

    // Handle unclaiming
    if (newStatus === "new" && currentStatus === "in-progress") {
      updateData.claimedAt = admin.firestore.FieldValue.delete();
      updateData.claimedBy = admin.firestore.FieldValue.delete();
      updateData.claimToken = admin.firestore.FieldValue.delete();
    }

    await docRef.update(updateData);

    await addJournalEntry(fullId, JOURNAL_TYPES.STATUS_CHANGE, `${currentStatus} → ${newStatus}`, {
      from: currentStatus,
      to: newStatus,
      notes,
    });

    console.log(`\n  ✅ Status updated: ${currentStatus} → ${newStatus}`);
    if (notes) {
      console.log(`     Notes: ${notes}`);
    }
    console.log();

    return true;
  } catch (error) {
    console.error(`\n  ❌ Failed to update status: ${error.message}\n`);
    return false;
  }
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Start a new brainstorming session.
 */
export async function startSession(title, options = {}) {
  return createItem("session", title, {
    participants: options.participants || ["austen", "claude"],
    ...options,
  });
}

/**
 * End a session with optional transcript attachment.
 */
export async function endSession(sessionId, transcriptPath = null, { strict = false } = {}) {
  const fullId = await resolveAndValidateId(sessionId);
  if (!fullId) return false;

  try {
    const docRef = db.collection(COLLECTIONS.ITEMS).doc(fullId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Session not found: ${fullId}\n`);
      return false;
    }

    if (doc.data().type !== "session") {
      console.log(`\n  ❌ Item ${fullId} is not a session\n`);
      return false;
    }

    // Strict mode: block closure if unresolved proposals or unanswered questions remain
    if (strict) {
      const { items: treeItems } = await linking.getSessionTree(db, fullId);
      const unresolved = [];

      for (const item of treeItems) {
        if (item.type === "proposal" && !item.verdict) {
          unresolved.push(`  ⚠️  PROPOSAL without verdict: ${item.id.substring(0, 8)}  ${(item.title || "(untitled)").substring(0, 50)}`);
        }
        if (item.type === "question") {
          const qDoc = await db.collection(COLLECTIONS.ITEMS).doc(item.id).get();
          const qData = qDoc.exists ? qDoc.data() : {};
          const tags = qData.tags || [];
          if (!qData.answer && !tags.includes("carries-to-next-session")) {
            unresolved.push(`  ⚠️  QUESTION unanswered:      ${item.id.substring(0, 8)}  ${(item.title || "(untitled)").substring(0, 50)}`);
          }
        }
      }

      if (unresolved.length > 0) {
        console.log(`
  ❌ STRICT MODE: Cannot close session — ${unresolved.length} unresolved item(s):
`);
        for (const line of unresolved) {
          console.log(line);
        }
        console.log(`
  Resolve these items first, then retry.
`);
        return false;
      }
    }

    const updateData = {
      status: "completed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (transcriptPath) {
      if (!existsSync(transcriptPath)) {
        console.log(`\n  ❌ Transcript file not found: ${transcriptPath}\n`);
        return false;
      }

      const transcript = readFileSync(transcriptPath, "utf8");
      updateData.transcript = transcript;

      await addJournalEntry(fullId, JOURNAL_TYPES.TRANSCRIPT_ATTACHED, `Transcript attached (${transcript.length} chars)`, {
        path: transcriptPath,
        length: transcript.length,
      });
    }

    await docRef.update(updateData);

    console.log(`\n  ✅ Session ended: ${fullId}`);
    if (transcriptPath) {
      console.log(`     Transcript attached: ${transcriptPath}`);
    }
    console.log();

    return true;
  } catch (error) {
    console.error(`\n  ❌ Failed to end session: ${error.message}\n`);
    return false;
  }
}

/**
 * Quickly capture an item during a session and link it.
 */
export async function capture(sessionId, type, content, options = {}) {
  const fullSessionId = await resolveAndValidateId(sessionId);
  if (!fullSessionId) return null;

  // Verify session exists
  const sessionDoc = await db.collection(COLLECTIONS.ITEMS).doc(fullSessionId).get();
  if (!sessionDoc.exists || sessionDoc.data().type !== "session") {
    console.log(`\n  ❌ Invalid session ID: ${sessionId}\n`);
    return null;
  }

  // Create the item
  const itemId = await createItem(type, content, options);
  if (!itemId) return null;

  // Link it to the session
  const linkResult = await linking.addLink(db, fullSessionId, itemId, "spawned", `Captured during session`);

  if (!linkResult.success) {
    console.log(`  ⚠️  Created item but failed to link: ${linkResult.error}`);
  } else {
    console.log(`  🔗 Linked to session ${fullSessionId.substring(0, 8)}...`);
  }

  return itemId;
}

// ============================================================================
// VERDICT OPERATIONS
// ============================================================================

/**
 * Set a verdict on a decision item.
 */
export async function setVerdict(docId, verdict, rationale = null) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return false;

  if (!VERDICT_TYPES.includes(verdict)) {
    console.log(`\n  ❌ Invalid verdict: ${verdict}`);
    console.log(`     Valid verdicts: ${VERDICT_TYPES.join(", ")}\n`);
    return false;
  }

  try {
    const docRef = db.collection(COLLECTIONS.ITEMS).doc(fullId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Item not found: ${fullId}\n`);
      return false;
    }

    const data = doc.data();

    if (data.type !== "decision") {
      console.log(`\n  ⚠️  Setting verdict on non-decision item (type: ${data.type})`);
    }

    const updateData = {
      verdict,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (rationale) {
      updateData.rationale = rationale;
    }

    // Archive rejected decisions
    if (verdict === "rejected") {
      updateData.status = "archived";
      updateData.archivedAt = admin.firestore.FieldValue.serverTimestamp();
      updateData.archiveReason = "rejected";
      updateData.rejectionReason = rationale || "";
    }

    // Mark accepted decisions as completed
    if (verdict === "accepted") {
      updateData.status = "completed";
    }

    await docRef.update(updateData);

    await addJournalEntry(fullId, JOURNAL_TYPES.VERDICT_SET, `Verdict: ${verdict}`, {
      verdict,
      rationale,
    });

    console.log(`\n  ✅ Verdict set: ${verdict}`);
    if (rationale) {
      console.log(`     Rationale: ${rationale}`);
    }
    console.log();

    return true;
  } catch (error) {
    console.error(`\n  ❌ Failed to set verdict: ${error.message}\n`);
    return false;
  }
}

/**
 * Answer a question item.
 */
export async function answerQuestion(docId, answer) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return false;

  try {
    const docRef = db.collection(COLLECTIONS.ITEMS).doc(fullId);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`\n  ❌ Item not found: ${fullId}\n`);
      return false;
    }

    if (doc.data().type !== "question") {
      console.log(`\n  ⚠️  Item is not a question (type: ${doc.data().type})\n`);
    }

    await docRef.update({
      answered: true,
      answer,
      status: "completed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await addJournalEntry(fullId, "answered", `Question answered`, { answer });

    console.log(`\n  ✅ Question answered\n`);
    return true;
  } catch (error) {
    console.error(`\n  ❌ Failed to answer question: ${error.message}\n`);
    return false;
  }
}

// ============================================================================
// TAGS
// ============================================================================

/**
 * Add a tag to an item.
 */
export async function addTag(docId, tag) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return false;

  try {
    await db.collection(COLLECTIONS.ITEMS).doc(fullId).update({
      tags: admin.firestore.FieldValue.arrayUnion(tag),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n  ✅ Added tag: ${tag}\n`);
    return true;
  } catch (error) {
    console.error(`\n  ❌ Failed to add tag: ${error.message}\n`);
    return false;
  }
}

/**
 * Remove a tag from an item.
 */
export async function removeTag(docId, tag) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return false;

  try {
    await db.collection(COLLECTIONS.ITEMS).doc(fullId).update({
      tags: admin.firestore.FieldValue.arrayRemove(tag),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n  ✅ Removed tag: ${tag}\n`);
    return true;
  } catch (error) {
    console.error(`\n  ❌ Failed to remove tag: ${error.message}\n`);
    return false;
  }
}
