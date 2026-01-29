/**
 * Museum Development Tracking System
 *
 * A parallel tracking system for creative worldbuilding work,
 * preserving session transcripts and enabling bidirectional linking.
 *
 * Run `node scripts/museum-dev.js help` to see all available commands.
 *
 * Key differences from feedback system:
 * - No notifications (internal tool only)
 * - Sessions can store full transcripts
 * - Bidirectional linking between items
 * - Verdicts instead of releases
 *
 * Workflow:
 *   1. Start a session: `museum session "Brainstorm title"`
 *   2. Capture decisions/questions during conversation: `museum capture <sessionId> decision "The decision"`
 *   3. End session with transcript: `museum session-end <sessionId> --transcript ./file.md`
 *   4. Link related items: `museum link <from> <to> spawned "Note"`
 *   5. Set verdicts on decisions: `museum <id> verdict accepted "Rationale"`
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import config from "../config/museum-dev.config.js";
import linking from "./lib/museum-linking.js";
import attachments from "./lib/museum-attachments.js";

// Generate a unique session ID for this script invocation
const SESSION_ID = randomUUID();

// Load service account key
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`,
});

const db = admin.firestore();

// Import config values
const {
  ADMIN_USER_ID,
  ITEM_TYPES,
  ELEMENT_SUBTYPES,
  LINK_TYPES,
  VERDICT_TYPES,
  STALE_THRESHOLDS,
  VALID_TRANSITIONS,
  JOURNAL_TYPES,
  STATUSES,
  COLLECTIONS,
} = config;

// ============================================================================
// SESSION REGISTRATION
// ============================================================================

async function registerSession() {
  try {
    const hostname = process.env.COMPUTERNAME || process.env.HOSTNAME || "unknown";

    await db.collection(COLLECTIONS.SESSIONS).doc(SESSION_ID).set({
      sessionId: SESSION_ID,
      agentType: "claude-cli",
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      activeClaims: [],
      userId: ADMIN_USER_ID,
      metadata: {
        hostname,
        pid: process.pid,
        cwd: process.cwd(),
        nodeVersion: process.version,
      },
    });

    console.log(`  📡 Session registered: ${SESSION_ID.substring(0, 8)}...`);
    return true;
  } catch (error) {
    console.error(`  ⚠️  Failed to register session: ${error.message}`);
    return false;
  }
}

// ============================================================================
// STALENESS & CLAIM HEALTH
// ============================================================================

function checkClaimStaleness(item) {
  const now = Date.now();
  const claimedAt = item.claimedAt?.toDate?.()?.getTime() || null;
  const lastActivity = item.lastActivity?.toDate?.()?.getTime() || claimedAt;

  if (!claimedAt) {
    return { isStale: true, reason: "no-claim-time", ageMs: Infinity, activityAgeMs: Infinity };
  }

  const totalAgeMs = now - claimedAt;
  const activityAgeMs = lastActivity ? now - lastActivity : totalAgeMs;

  if (totalAgeMs > STALE_THRESHOLDS.TOTAL_CLAIM_MAX_MS) {
    return { isStale: true, reason: "exceeded-max-time", ageMs: totalAgeMs, activityAgeMs };
  }

  if (activityAgeMs > STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS) {
    return { isStale: true, reason: "no-activity", ageMs: totalAgeMs, activityAgeMs };
  }

  return { isStale: false, reason: null, ageMs: totalAgeMs, activityAgeMs };
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

// ============================================================================
// PARTIAL ID RESOLUTION
// ============================================================================

async function resolvePartialId(partialId) {
  if (partialId.length >= 20) {
    const doc = await db.collection(COLLECTIONS.ITEMS).doc(partialId).get();
    if (doc.exists) {
      return { fullId: partialId, error: null, matches: [partialId] };
    }
    return { fullId: null, error: `Item not found: ${partialId}`, matches: [] };
  }

  const snapshot = await db.collection(COLLECTIONS.ITEMS)
    .where("status", "in", ["new", "in-progress", "in-review", "completed"])
    .get();

  const matches = [];
  snapshot.forEach(doc => {
    if (doc.id.startsWith(partialId)) {
      matches.push(doc.id);
    }
  });

  if (matches.length === 0) {
    const archivedSnapshot = await db.collection(COLLECTIONS.ITEMS)
      .where("status", "==", "archived")
      .limit(500)
      .get();

    archivedSnapshot.forEach(doc => {
      if (doc.id.startsWith(partialId)) {
        matches.push(doc.id);
      }
    });
  }

  if (matches.length === 0) {
    return { fullId: null, error: `No item found matching ID prefix: ${partialId}`, matches: [] };
  }

  if (matches.length === 1) {
    return { fullId: matches[0], error: null, matches };
  }

  return {
    fullId: null,
    error: `Ambiguous ID prefix "${partialId}" matches ${matches.length} items`,
    matches
  };
}

async function resolveAndValidateId(partialId) {
  const { fullId, error, matches } = await resolvePartialId(partialId);

  if (error) {
    console.log(`\n  ❌ ${error}`);
    if (matches.length > 1) {
      console.log(`\n  Matching IDs:`);
      matches.slice(0, 5).forEach(id => {
        console.log(`     ${id}`);
      });
      if (matches.length > 5) {
        console.log(`     ... and ${matches.length - 5} more`);
      }
      console.log(`\n  Please provide more characters to disambiguate.\n`);
    }
    return null;
  }

  if (partialId.length < 20 && fullId) {
    console.log(`  🔗 Resolved ${partialId}... → ${fullId}`);
  }

  return fullId;
}

// ============================================================================
// WORK JOURNAL
// ============================================================================

async function addJournalEntry(docId, type, message = "", data = {}) {
  try {
    const journalRef = db
      .collection(COLLECTIONS.ITEMS)
      .doc(docId)
      .collection("journal")
      .doc();

    await journalRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type,
      sessionId: SESSION_ID,
      message,
      data,
    });

    return journalRef.id;
  } catch (error) {
    console.error(`  ⚠️  Failed to write journal entry: ${error.message}`);
    return null;
  }
}

async function getJournalEntries(docId, limit = 20) {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.ITEMS)
      .doc(docId)
      .collection("journal")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || null,
    }));
  } catch (error) {
    console.error(`  ⚠️  Failed to read journal: ${error.message}`);
    return [];
  }
}

// ============================================================================
// STATE MACHINE
// ============================================================================

function validateTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return { valid: true, error: null };
  }

  const allowed = VALID_TRANSITIONS[fromStatus] || [];

  if (!allowed.includes(toStatus)) {
    const allowedStr = allowed.length > 0 ? allowed.join(", ") : "none";
    return {
      valid: false,
      error: `Invalid transition: ${fromStatus} → ${toStatus}. Allowed: ${allowedStr}`,
    };
  }

  return { valid: true, error: null };
}

// ============================================================================
// CORE ITEM OPERATIONS
// ============================================================================

/**
 * Create a new museum development item
 */
async function createItem(type, title, options = {}) {
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
 * Get an item by ID
 */
async function getItemById(docId) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return null;

  try {
    const doc = await db.collection(COLLECTIONS.ITEMS).doc(fullId).get();

    if (!doc.exists) {
      console.log(`\n  ❌ Item not found: ${fullId}\n`);
      return null;
    }

    const data = doc.data();
    const createdAt = data.createdAt?.toDate?.()?.toLocaleString() || "Unknown";
    const updatedAt = data.updatedAt?.toDate?.()?.toLocaleString() || "Unknown";

    console.log("\n" + "=".repeat(70));
    console.log(`\n  📋 MUSEUM ITEM DETAILS\n`);
    console.log("─".repeat(70));
    console.log(`  ID: ${fullId}`);
    console.log(`  Type: ${data.type || "N/A"}`);
    console.log(`  Status: ${data.status || "new"}`);
    console.log(`  Created: ${createdAt}`);
    console.log(`  Updated: ${updatedAt}`);

    if (data.type === "element" && data.elementType) {
      console.log(`  Element Type: ${data.elementType}`);
    }

    if (data.verdict) {
      console.log(`  Verdict: ${data.verdict}`);
    }

    if (data.tags && data.tags.length > 0) {
      console.log(`  Tags: ${data.tags.join(", ")}`);
    }

    console.log("─".repeat(70));
    console.log(`  Title: ${data.title || "(untitled)"}`);
    console.log("─".repeat(70));

    if (data.description) {
      console.log(`  Description:\n`);
      const desc = data.description;
      const lines = desc.split("\n");
      lines.forEach((line) => {
        console.log(`    ${line}`);
      });
      console.log();
    }

    if (data.type === "session" && data.transcript) {
      console.log("─".repeat(70));
      console.log(`  Transcript: ${data.transcript.length} characters`);
      console.log(`  (Use 'museum transcript <id>' to view full transcript)`);
    }

    if (data.verdict && data.rationale) {
      console.log("─".repeat(70));
      console.log(`  Rationale: ${data.rationale}`);
    }

    if (data.type === "question") {
      console.log("─".repeat(70));
      console.log(`  Answered: ${data.answered ? "Yes" : "No"}`);
      if (data.answer) {
        console.log(`  Answer: ${data.answer}`);
      }
    }

    // Show links
    const links = await linking.getLinks(db, fullId);
    if (links.linksTo.length > 0 || links.linkedFrom.length > 0) {
      console.log("─".repeat(70));
      console.log(`  Links:`);

      if (links.linkedFrom.length > 0) {
        console.log(`\n  ← Linked FROM:`);
        links.linkedFrom.forEach((l) => {
          console.log(`     [${l.type}] ${l.docId.substring(0, 8)}... - ${l.title}`);
        });
      }

      if (links.linksTo.length > 0) {
        console.log(`\n  → Links TO:`);
        links.linksTo.forEach((l) => {
          console.log(`     [${l.type}] ${l.docId.substring(0, 8)}... - ${l.title}`);
        });
      }
    }

    // Show attachments
    if (data.attachments && data.attachments.length > 0) {
      console.log("─".repeat(70));
      console.log(`  Attachments (${data.attachments.length}):`);
      data.attachments.forEach((att) => {
        console.log(`     [${att.type}] ${att.name}${att.description ? ` - ${att.description}` : ""}`);
      });
    }

    console.log("\n" + "=".repeat(70) + "\n");

    return { id: fullId, ...data };
  } catch (error) {
    console.error(`\n  ❌ Error fetching item: ${error.message}\n`);
    return null;
  }
}

/**
 * List all items with optional filters
 */
async function listItems(options = {}) {
  console.log("\n📋 Museum Development Tracker\n");
  console.log("=".repeat(70));

  try {
    let query = db.collection(COLLECTIONS.ITEMS);

    if (options.type) {
      query = query.where("type", "==", options.type);
    }

    if (options.status) {
      query = query.where("status", "==", options.status);
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();

    if (snapshot.empty) {
      console.log("\n  No items found.\n");
      return;
    }

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Count by status
    const counts = { new: 0, "in-progress": 0, "in-review": 0, completed: 0, archived: 0 };
    items.forEach((item) => {
      const status = item.status || "new";
      if (counts.hasOwnProperty(status)) {
        counts[status]++;
      }
    });

    console.log(
      `\n  Total: ${items.length} items | ${counts.new} new | ${counts["in-progress"]} in progress | ${counts.completed} completed\n`
    );
    console.log("─".repeat(70));

    // Group by type
    const byType = {};
    items.forEach((item) => {
      const type = item.type || "unknown";
      if (!byType[type]) byType[type] = [];
      byType[type].push(item);
    });

    for (const [type, typeItems] of Object.entries(byType)) {
      const emoji = {
        session: "📝",
        decision: "⚖️",
        question: "❓",
        element: "🏛️",
        reference: "📚",
      }[type] || "📄";

      console.log(`\n  ${emoji} ${type.toUpperCase()} (${typeItems.length}):\n`);

      typeItems.slice(0, 10).forEach((item) => {
        const title = (item.title || "(untitled)").substring(0, 50);
        const status = item.status || "new";
        const verdict = item.verdict ? ` [${item.verdict}]` : "";
        console.log(
          `     ${item.id.substring(0, 8)}... | ${status.padEnd(11)} | ${title}${item.title?.length > 50 ? "..." : ""}${verdict}`
        );
      });

      if (typeItems.length > 10) {
        console.log(`     ... and ${typeItems.length - 10} more`);
      }
    }

    console.log("\n" + "=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n  Error listing items:", error.message);
    throw error;
  }
}

/**
 * Update item status
 */
async function updateItemStatus(docId, newStatus, notes = null) {
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
 * Start a new brainstorming session
 */
async function startSession(title, options = {}) {
  return createItem("session", title, {
    participants: options.participants || ["austen", "claude"],
    ...options,
  });
}

/**
 * End a session with optional transcript
 */
async function endSession(sessionId, transcriptPath = null) {
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
 * View session transcript
 */
async function viewTranscript(sessionId) {
  const fullId = await resolveAndValidateId(sessionId);
  if (!fullId) return;

  try {
    const doc = await db.collection(COLLECTIONS.ITEMS).doc(fullId).get();

    if (!doc.exists) {
      console.log(`\n  ❌ Session not found: ${fullId}\n`);
      return;
    }

    const data = doc.data();

    if (data.type !== "session") {
      console.log(`\n  ❌ Item ${fullId} is not a session\n`);
      return;
    }

    if (!data.transcript) {
      console.log(`\n  ℹ️  No transcript attached to session ${fullId}\n`);
      return;
    }

    console.log("\n" + "=".repeat(70));
    console.log(`\n  📝 TRANSCRIPT: ${data.title}\n`);
    console.log("─".repeat(70));
    console.log(data.transcript);
    console.log("─".repeat(70));
    console.log(`  ${data.transcript.length} characters`);
    console.log("\n" + "=".repeat(70) + "\n");
  } catch (error) {
    console.error(`\n  ❌ Failed to read transcript: ${error.message}\n`);
  }
}

// ============================================================================
// QUICK CAPTURE
// ============================================================================

/**
 * Quickly capture an item during a session
 */
async function capture(sessionId, type, content, options = {}) {
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
 * Set a verdict on a decision
 */
async function setVerdict(docId, verdict, rationale = null) {
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

// ============================================================================
// LINKING OPERATIONS
// ============================================================================

/**
 * Link two items
 */
async function linkItems(fromId, toId, linkType, note = null) {
  const fullFromId = await resolveAndValidateId(fromId);
  if (!fullFromId) return false;

  const fullToId = await resolveAndValidateId(toId);
  if (!fullToId) return false;

  const result = await linking.addLink(db, fullFromId, fullToId, linkType, note);

  if (!result.success) {
    console.log(`\n  ❌ Failed to link: ${result.error}\n`);
    return false;
  }

  console.log(`\n  ✅ Linked: ${fullFromId.substring(0, 8)}... → [${linkType}] → ${fullToId.substring(0, 8)}...`);
  if (note) {
    console.log(`     Note: ${note}`);
  }
  console.log();

  return true;
}

/**
 * Remove a link between items
 */
async function unlinkItems(fromId, toId) {
  const fullFromId = await resolveAndValidateId(fromId);
  if (!fullFromId) return false;

  const fullToId = await resolveAndValidateId(toId);
  if (!fullToId) return false;

  const result = await linking.removeLink(db, fullFromId, fullToId);

  if (!result.success) {
    console.log(`\n  ❌ Failed to unlink: ${result.error}\n`);
    return false;
  }

  if (!result.removed) {
    console.log(`\n  ℹ️  No link exists between these items\n`);
    return true;
  }

  console.log(`\n  ✅ Unlinked: ${fullFromId.substring(0, 8)}... ↔ ${fullToId.substring(0, 8)}...\n`);
  return true;
}

/**
 * Show all links for an item
 */
async function showLinks(docId) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return;

  const result = await linking.getLinks(db, fullId);

  if (result.error) {
    console.log(`\n  ❌ ${result.error}\n`);
    return;
  }

  console.log("\n" + "=".repeat(70));
  console.log(`\n  🔗 LINKS FOR ${fullId.substring(0, 8)}...\n`);
  console.log("─".repeat(70));

  if (result.linkedFrom.length === 0 && result.linksTo.length === 0) {
    console.log("  No links found.\n");
    console.log("=".repeat(70) + "\n");
    return;
  }

  if (result.linkedFrom.length > 0) {
    console.log(`\n  ← LINKED FROM (${result.linkedFrom.length}):\n`);
    result.linkedFrom.forEach((link) => {
      const addedAt = link.addedAt?.toLocaleString?.() || link.addedAt || "Unknown";
      console.log(`     [${link.type}] ${link.docId.substring(0, 8)}... - ${link.title}`);
      if (link.note) {
        console.log(`       Note: ${link.note}`);
      }
    });
  }

  if (result.linksTo.length > 0) {
    console.log(`\n  → LINKS TO (${result.linksTo.length}):\n`);
    result.linksTo.forEach((link) => {
      console.log(`     [${link.type}] ${link.docId.substring(0, 8)}... - ${link.title}`);
      if (link.note) {
        console.log(`       Note: ${link.note}`);
      }
    });
  }

  console.log("\n" + "=".repeat(70) + "\n");
}

/**
 * Trace an item back to its source session(s)
 */
async function traceToSession(docId) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return;

  const result = await linking.traceToSession(db, fullId);

  if (result.error) {
    console.log(`\n  ❌ ${result.error}\n`);
    return;
  }

  console.log("\n" + "=".repeat(70));
  console.log(`\n  🔍 TRACE TO SESSION: ${fullId.substring(0, 8)}...\n`);
  console.log("─".repeat(70));

  if (result.sessions.length === 0) {
    console.log("  No source sessions found (item may be a session itself or unlinked).\n");
    console.log("=".repeat(70) + "\n");
    return;
  }

  console.log(`\n  Source Sessions (${result.sessions.length}):\n`);
  result.sessions.forEach((session) => {
    const date = session.sessionDate?.toLocaleString?.() || "Unknown date";
    console.log(`     📝 ${session.id.substring(0, 8)}... - ${session.title}`);
    console.log(`        Date: ${date}`);
  });

  if (result.path.length > 1) {
    console.log(`\n  Traversal Path:\n`);
    result.path.forEach((item, idx) => {
      const prefix = idx === 0 ? "  " : "    └─";
      console.log(`     ${prefix}[${item.type}] ${item.id.substring(0, 8)}... - ${item.title}`);
    });
  }

  console.log("\n" + "=".repeat(70) + "\n");
}

/**
 * Show all items spawned from a session
 */
async function showSessionTree(sessionId) {
  const fullId = await resolveAndValidateId(sessionId);
  if (!fullId) return;

  const result = await linking.getSessionTree(db, fullId);

  if (result.error) {
    console.log(`\n  ❌ ${result.error}\n`);
    return;
  }

  // Get session title
  const sessionDoc = await db.collection(COLLECTIONS.ITEMS).doc(fullId).get();
  const sessionTitle = sessionDoc.exists ? sessionDoc.data().title : "(untitled)";

  console.log("\n" + "=".repeat(70));
  console.log(`\n  🌳 SESSION TREE: ${sessionTitle}\n`);
  console.log("─".repeat(70));

  if (result.items.length === 0) {
    console.log("  No items spawned from this session.\n");
    console.log("=".repeat(70) + "\n");
    return;
  }

  console.log(`\n  Items (${result.items.length}):\n`);

  // Group by type
  const byType = {};
  result.items.forEach((item) => {
    if (!byType[item.type]) byType[item.type] = [];
    byType[item.type].push(item);
  });

  for (const [type, items] of Object.entries(byType)) {
    console.log(`\n  ${type.toUpperCase()} (${items.length}):`);
    items.forEach((item) => {
      const verdict = item.verdict ? ` [${item.verdict}]` : "";
      console.log(`     ${item.id.substring(0, 8)}... - ${item.title}${verdict}`);
    });
  }

  console.log("\n" + "=".repeat(70) + "\n");
}

// ============================================================================
// SEARCH
// ============================================================================

async function searchItems(query) {
  console.log(`\n  🔍 Searching for: "${query}"\n`);

  try {
    const snapshot = await db.collection(COLLECTIONS.ITEMS).get();

    const queryLower = query.toLowerCase();
    const matches = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const searchableText = [
        data.title || "",
        data.description || "",
        data.rationale || "",
        data.answer || "",
        ...(data.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      if (searchableText.includes(queryLower)) {
        matches.push({ id: doc.id, ...data });
      }
    });

    if (matches.length === 0) {
      console.log("  No matches found.\n");
      return;
    }

    console.log(`  Found ${matches.length} matches:\n`);
    console.log("─".repeat(70));

    matches.forEach((item) => {
      const title = (item.title || "(untitled)").substring(0, 50);
      const verdict = item.verdict ? ` [${item.verdict}]` : "";
      console.log(
        `  ${item.id.substring(0, 8)}... | ${item.type.padEnd(10)} | ${title}${item.title?.length > 50 ? "..." : ""}${verdict}`
      );
    });

    console.log("─".repeat(70) + "\n");
  } catch (error) {
    console.error(`\n  ❌ Search failed: ${error.message}\n`);
  }
}

// ============================================================================
// JOURNAL
// ============================================================================

async function showJournal(docId, limit = 20) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return;

  const entries = await getJournalEntries(fullId, limit);

  console.log("\n" + "=".repeat(70));
  console.log(`\n  📖 JOURNAL: ${fullId.substring(0, 8)}...\n`);
  console.log("─".repeat(70));

  if (entries.length === 0) {
    console.log("  No journal entries.\n");
    console.log("=".repeat(70) + "\n");
    return;
  }

  entries.forEach((entry) => {
    const timestamp = entry.timestamp?.toLocaleString?.() || "Unknown";
    const icon = {
      created: "✨",
      claimed: "🔒",
      status_change: "📊",
      link_added: "🔗",
      link_removed: "✂️",
      verdict_set: "⚖️",
      transcript_attached: "📝",
      attachment_added: "📎",
      note: "📌",
    }[entry.type] || "•";

    console.log(`\n  ${icon} ${entry.type} - ${timestamp}`);
    if (entry.message) {
      console.log(`     ${entry.message}`);
    }
  });

  console.log("\n" + "=".repeat(70) + "\n");
}

// ============================================================================
// TAGS
// ============================================================================

async function addTag(docId, tag) {
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

async function removeTag(docId, tag) {
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

// ============================================================================
// ATTACHMENTS
// ============================================================================

async function addAttachmentCommand(docId, filePath, description = null) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return false;

  const result = await attachments.addAttachment(db, fullId, filePath, description);

  if (!result.success) {
    console.log(`\n  ❌ Failed to add attachment: ${result.error}\n`);
    return false;
  }

  console.log(`\n  ✅ Attachment added: ${result.attachmentId}`);
  console.log(`     URL: ${result.url}\n`);
  return true;
}

async function addUrlCommand(docId, url, description = null) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return false;

  const result = await attachments.addUrlAttachment(db, fullId, url, description);

  if (!result.success) {
    console.log(`\n  ❌ Failed to add URL: ${result.error}\n`);
    return false;
  }

  console.log(`\n  ✅ URL attached: ${result.attachmentId}\n`);
  return true;
}

async function listAttachmentsCommand(docId) {
  const fullId = await resolveAndValidateId(docId);
  if (!fullId) return;

  const result = await attachments.listAttachments(db, fullId);

  if (result.error) {
    console.log(`\n  ❌ ${result.error}\n`);
    return;
  }

  console.log("\n" + "=".repeat(70));
  console.log(`\n  📎 ATTACHMENTS: ${fullId.substring(0, 8)}...\n`);
  console.log("─".repeat(70));

  if (result.attachments.length === 0) {
    console.log("  No attachments.\n");
    console.log("=".repeat(70) + "\n");
    return;
  }

  result.attachments.forEach((att) => {
    const addedAt = att.addedAt?.toLocaleString?.() || "Unknown";
    console.log(`\n  [${att.type}] ${att.name}`);
    console.log(`     ID: ${att.id}`);
    console.log(`     URL: ${att.url}`);
    if (att.description) {
      console.log(`     Description: ${att.description}`);
    }
    console.log(`     Added: ${addedAt}`);
  });

  console.log("\n" + "=".repeat(70) + "\n");
}

// ============================================================================
// ANSWER QUESTION
// ============================================================================

async function answerQuestion(docId, answer) {
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
// HELP
// ============================================================================

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                MUSEUM DEVELOPMENT TRACKING SYSTEM                     ║
╚══════════════════════════════════════════════════════════════════════╝

QUICK CAPTURE (during sessions):
  museum session "Title"              Start a new session
  museum capture <sessionId> decision "The decision"
  museum capture <sessionId> question "The question"
  museum session-end <sessionId> --transcript ./file.md

QUEUE COMMANDS:
  museum                              List all items
  museum list                         List all items
  museum list --type decision         Filter by type
  museum list --status completed      Filter by status
  museum <id>                         View item details
  museum <id> <status> [notes]        Update status

ITEM CREATION:
  museum create decision "Title"      Create a decision
  museum create question "Title"      Create a question
  museum create element "Title" --element-type wing
  museum create reference "Title"     Create a reference

LINKING:
  museum link <from> <to> spawned "Note"
  museum link <from> <to> derived "Note"
  museum link <from> <to> related "Note"
  museum link <from> <to> contradicts "Note"
  museum link <from> <to> answers "Note"
  museum unlink <from> <to>           Remove link
  museum links <id>                   Show all links
  museum trace <id>                   Trace to source session
  museum tree <sessionId>             Show all items from session

VERDICTS (for decisions):
  museum <id> verdict accepted "Rationale"
  museum <id> verdict rejected "Rationale"
  museum <id> verdict deferred "Rationale"
  museum <id> verdict superseded "Rationale"

QUESTIONS:
  museum <id> answer "The answer"     Answer a question

TAGS:
  museum <id> tag add <tag>           Add a tag
  museum <id> tag remove <tag>        Remove a tag

ATTACHMENTS:
  museum <id> attach ./file.png "Description"
  museum <id> attach-url https://... "Description"
  museum <id> attachments             List attachments

OTHER:
  museum search "query"               Search items
  museum journal <id>                 View activity journal
  museum transcript <id>              View session transcript
  museum help                         Show this help

ITEM TYPES: ${ITEM_TYPES.join(", ")}
ELEMENT SUBTYPES: ${ELEMENT_SUBTYPES.join(", ")}
LINK TYPES: ${LINK_TYPES.join(", ")}
VERDICT TYPES: ${VERDICT_TYPES.join(", ")}
STATUSES: ${STATUSES.join(", ")}
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Always register session
  await registerSession();

  if (args.length === 0 || args[0] === "list") {
    // Parse list options
    const options = {};
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--type" && args[i + 1]) {
        options.type = args[++i];
      } else if (args[i] === "--status" && args[i + 1]) {
        options.status = args[++i];
      }
    }
    return listItems(options);
  }

  const command = args[0];

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      return showHelp();

    case "session":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum session <title>\n");
        return;
      }
      return startSession(args.slice(1).join(" "));

    case "session-end":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum session-end <sessionId> [--transcript <path>]\n");
        return;
      }
      const transcriptIdx = args.indexOf("--transcript");
      const transcriptPath = transcriptIdx !== -1 ? args[transcriptIdx + 1] : null;
      return endSession(args[1], transcriptPath);

    case "capture":
      if (args.length < 4) {
        console.log("\n  ❌ Usage: museum capture <sessionId> <type> <content>\n");
        return;
      }
      return capture(args[1], args[2], args.slice(3).join(" "));

    case "create":
      if (args.length < 3) {
        console.log("\n  ❌ Usage: museum create <type> <title> [--element-type <subtype>]\n");
        return;
      }
      const createOptions = {};
      const elementTypeIdx = args.indexOf("--element-type");
      if (elementTypeIdx !== -1 && args[elementTypeIdx + 1]) {
        createOptions.elementType = args[elementTypeIdx + 1];
      }
      const titleParts = args.slice(2).filter((_, i) => {
        const globalI = i + 2;
        return globalI !== elementTypeIdx && globalI !== elementTypeIdx + 1;
      });
      return createItem(args[1], titleParts.join(" "), createOptions);

    case "link":
      if (args.length < 4) {
        console.log("\n  ❌ Usage: museum link <from> <to> <type> [note]\n");
        return;
      }
      return linkItems(args[1], args[2], args[3], args.slice(4).join(" ") || null);

    case "unlink":
      if (args.length < 3) {
        console.log("\n  ❌ Usage: museum unlink <from> <to>\n");
        return;
      }
      return unlinkItems(args[1], args[2]);

    case "links":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum links <id>\n");
        return;
      }
      return showLinks(args[1]);

    case "trace":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum trace <id>\n");
        return;
      }
      return traceToSession(args[1]);

    case "tree":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum tree <sessionId>\n");
        return;
      }
      return showSessionTree(args[1]);

    case "search":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum search <query>\n");
        return;
      }
      return searchItems(args.slice(1).join(" "));

    case "journal":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum journal <id>\n");
        return;
      }
      return showJournal(args[1], parseInt(args[2]) || 20);

    case "transcript":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum transcript <sessionId>\n");
        return;
      }
      return viewTranscript(args[1]);

    default:
      // Check if it's an ID (view or update)
      if (args[0].length >= 6) {
        // Second arg determines action
        if (!args[1]) {
          // Just view the item
          return getItemById(args[0]);
        }

        // Check for special subcommands
        if (args[1] === "verdict") {
          if (args.length < 3) {
            console.log("\n  ❌ Usage: museum <id> verdict <type> [rationale]\n");
            return;
          }
          return setVerdict(args[0], args[2], args.slice(3).join(" ") || null);
        }

        if (args[1] === "answer") {
          if (args.length < 3) {
            console.log("\n  ❌ Usage: museum <id> answer <answer>\n");
            return;
          }
          return answerQuestion(args[0], args.slice(2).join(" "));
        }

        if (args[1] === "tag") {
          if (args[2] === "add" && args[3]) {
            return addTag(args[0], args[3]);
          }
          if (args[2] === "remove" && args[3]) {
            return removeTag(args[0], args[3]);
          }
          console.log("\n  ❌ Usage: museum <id> tag add|remove <tag>\n");
          return;
        }

        if (args[1] === "attach") {
          if (!args[2]) {
            console.log("\n  ❌ Usage: museum <id> attach <filepath> [description]\n");
            return;
          }
          return addAttachmentCommand(args[0], args[2], args.slice(3).join(" ") || null);
        }

        if (args[1] === "attach-url") {
          if (!args[2]) {
            console.log("\n  ❌ Usage: museum <id> attach-url <url> [description]\n");
            return;
          }
          return addUrlCommand(args[0], args[2], args.slice(3).join(" ") || null);
        }

        if (args[1] === "attachments") {
          return listAttachmentsCommand(args[0]);
        }

        // Otherwise, treat as status update
        if (STATUSES.includes(args[1])) {
          return updateItemStatus(args[0], args[1], args.slice(2).join(" ") || null);
        }

        console.log(`\n  ❌ Unknown command or invalid status: ${args[1]}`);
        console.log(`     Valid statuses: ${STATUSES.join(", ")}`);
        console.log(`     Or try: verdict, answer, tag, attach, attach-url, attachments\n`);
        return;
      }

      console.log(`\n  ❌ Unknown command: ${command}`);
      console.log("     Run 'museum help' for usage.\n");
  }
}

// Run main and handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n  ❌ Error:", error.message);
    process.exit(1);
  });
