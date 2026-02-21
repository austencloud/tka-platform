/**
 * Museum Firebase Infrastructure
 *
 * Shared Firebase utilities for the museum development tracking system:
 * - Firebase Admin initialization and db export
 * - Partial ID resolution
 * - Journal (append-only activity log)
 * - State machine transitions
 * - Agent session registration
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import config from "../../config/museum-dev.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { ADMIN_USER_ID, VALID_TRANSITIONS, JOURNAL_TYPES, COLLECTIONS } = config;

// Generate a unique session ID for this script invocation
const SESSION_ID = randomUUID();

// Load service account key (resolved relative to this file, not CWD)
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, "../../serviceAccountKey.json"), "utf8")
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`,
});

export const db = admin.firestore();

// ============================================================================
// PARTIAL ID RESOLUTION
// ============================================================================

/**
 * Resolve a partial ID prefix to a full document ID.
 * Full IDs (>= 20 chars) are looked up directly.
 * Partial IDs are matched against all non-archived items first, then archived.
 */
export async function resolvePartialId(partialId) {
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

/**
 * Resolve a partial ID and print feedback to console.
 * Returns the full ID or null.
 */
export async function resolveAndValidateId(partialId) {
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

/**
 * Append an entry to an item's activity journal.
 */
export async function addJournalEntry(docId, type, message = "", data = {}) {
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

/**
 * Read recent journal entries for an item.
 */
export async function getJournalEntries(docId, limit = 20) {
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

/**
 * Validate a status transition against the allowed state machine.
 */
export function validateTransition(fromStatus, toStatus) {
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
// SESSION REGISTRATION
// ============================================================================

/**
 * Register an agent session in Firestore for tracking.
 * Only called for write operations to avoid unnecessary Firestore writes.
 */
export async function registerSession() {
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

// Re-export admin for FieldValue access in other modules
export { admin };
