/**
 * Museum Linking Module
 *
 * Handles bidirectional linking between museum development items.
 * Links are stored on both items for efficient traversal in either direction.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import config from "../../config/museum-dev.config.js";

const { COLLECTIONS, LINK_TYPES, JOURNAL_TYPES } = config;

/**
 * Add a bidirectional link between two items
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} fromId - Source item ID
 * @param {string} toId - Target item ID
 * @param {string} linkType - Type of link (spawned, derived, related, contradicts, answers)
 * @param {string} [note] - Optional note describing the relationship
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function addLink(db, fromId, toId, linkType, note = null) {
  if (!LINK_TYPES.includes(linkType)) {
    return {
      success: false,
      error: `Invalid link type: ${linkType}. Valid types: ${LINK_TYPES.join(", ")}`,
    };
  }

  // Prevent self-linking
  if (fromId === toId) {
    return { success: false, error: "Cannot link an item to itself" };
  }

  const collection = db.collection(COLLECTIONS.ITEMS);
  const fromRef = collection.doc(fromId);
  const toRef = collection.doc(toId);

  try {
    // Verify both items exist
    const [fromDoc, toDoc] = await Promise.all([fromRef.get(), toRef.get()]);

    if (!fromDoc.exists) {
      return { success: false, error: `Source item not found: ${fromId}` };
    }
    if (!toDoc.exists) {
      return { success: false, error: `Target item not found: ${toId}` };
    }

    const now = Timestamp.now();
    const linkData = {
      docId: toId,
      type: linkType,
      addedAt: now,
      ...(note && { note }),
    };

    const reverseLinkData = {
      docId: fromId,
      type: linkType,
      addedAt: now,
      ...(note && { note }),
    };

    // Use a batch to update both items atomically
    const batch = db.batch();

    // Add forward link (linksTo on source)
    batch.update(fromRef, {
      linksTo: FieldValue.arrayUnion(linkData),
      updatedAt: now,
    });

    // Add reverse link (linkedFrom on target)
    batch.update(toRef, {
      linkedFrom: FieldValue.arrayUnion(reverseLinkData),
      updatedAt: now,
    });

    // Add journal entries for both
    const fromJournalRef = fromRef.collection("journal").doc();
    const toJournalRef = toRef.collection("journal").doc();

    batch.set(fromJournalRef, {
      type: JOURNAL_TYPES.LINK_ADDED,
      timestamp: now,
      data: { targetId: toId, linkType, direction: "outgoing", note },
    });

    batch.set(toJournalRef, {
      type: JOURNAL_TYPES.LINK_ADDED,
      timestamp: now,
      data: { sourceId: fromId, linkType, direction: "incoming", note },
    });

    await batch.commit();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove a link between two items (both directions)
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} fromId - Source item ID
 * @param {string} toId - Target item ID
 * @returns {Promise<{success: boolean, removed: boolean, error?: string}>}
 */
async function removeLink(db, fromId, toId) {
  const collection = db.collection(COLLECTIONS.ITEMS);
  const fromRef = collection.doc(fromId);
  const toRef = collection.doc(toId);

  try {
    const [fromDoc, toDoc] = await Promise.all([fromRef.get(), toRef.get()]);

    if (!fromDoc.exists || !toDoc.exists) {
      return { success: false, removed: false, error: "One or both items not found" };
    }

    const fromData = fromDoc.data();
    const toData = toDoc.data();

    // Find the links to remove
    const forwardLink = (fromData.linksTo || []).find((l) => l.docId === toId);
    const reverseLink = (toData.linkedFrom || []).find((l) => l.docId === fromId);

    if (!forwardLink && !reverseLink) {
      return { success: true, removed: false }; // No link exists
    }

    const now = Timestamp.now();
    const batch = db.batch();

    // Remove forward link
    if (forwardLink) {
      batch.update(fromRef, {
        linksTo: FieldValue.arrayRemove(forwardLink),
        updatedAt: now,
      });
    }

    // Remove reverse link
    if (reverseLink) {
      batch.update(toRef, {
        linkedFrom: FieldValue.arrayRemove(reverseLink),
        updatedAt: now,
      });
    }

    // Add journal entries
    const fromJournalRef = fromRef.collection("journal").doc();
    const toJournalRef = toRef.collection("journal").doc();

    batch.set(fromJournalRef, {
      type: JOURNAL_TYPES.LINK_REMOVED,
      timestamp: now,
      data: { targetId: toId },
    });

    batch.set(toJournalRef, {
      type: JOURNAL_TYPES.LINK_REMOVED,
      timestamp: now,
      data: { sourceId: fromId },
    });

    await batch.commit();

    return { success: true, removed: true };
  } catch (error) {
    return { success: false, removed: false, error: error.message };
  }
}

/**
 * Get all links to and from an item
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} docId - Item ID
 * @returns {Promise<{linksTo: Array, linkedFrom: Array, error?: string}>}
 */
async function getLinks(db, docId) {
  const collection = db.collection(COLLECTIONS.ITEMS);
  const docRef = collection.doc(docId);

  try {
    const doc = await docRef.get();

    if (!doc.exists) {
      return { linksTo: [], linkedFrom: [], error: `Item not found: ${docId}` };
    }

    const data = doc.data();

    // Enrich links with item titles for display
    const allIds = [
      ...(data.linksTo || []).map((l) => l.docId),
      ...(data.linkedFrom || []).map((l) => l.docId),
    ];

    const uniqueIds = [...new Set(allIds)];
    const titleMap = {};

    if (uniqueIds.length > 0) {
      const docs = await Promise.all(
        uniqueIds.map((id) => collection.doc(id).get())
      );
      docs.forEach((d) => {
        if (d.exists) {
          titleMap[d.id] = d.data().title || "(untitled)";
        }
      });
    }

    const enrichLink = (link) => ({
      ...link,
      title: titleMap[link.docId] || "(deleted)",
      addedAt: link.addedAt?.toDate?.() || link.addedAt,
    });

    return {
      linksTo: (data.linksTo || []).map(enrichLink),
      linkedFrom: (data.linkedFrom || []).map(enrichLink),
    };
  } catch (error) {
    return { linksTo: [], linkedFrom: [], error: error.message };
  }
}

/**
 * Trace an item back to its source session(s)
 *
 * Walks the linkedFrom chain following "spawned" links
 * until reaching items with type="session".
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} docId - Starting item ID
 * @param {number} [maxDepth=10] - Maximum traversal depth
 * @returns {Promise<{sessions: Array, path: Array, error?: string}>}
 */
async function traceToSession(db, docId, maxDepth = 10) {
  const collection = db.collection(COLLECTIONS.ITEMS);
  const visited = new Set();
  const sessions = [];
  const path = [];

  async function traverse(currentId, depth) {
    if (depth > maxDepth || visited.has(currentId)) {
      return;
    }

    visited.add(currentId);

    const doc = await collection.doc(currentId).get();
    if (!doc.exists) return;

    const data = doc.data();
    const item = {
      id: currentId,
      type: data.type,
      title: data.title || "(untitled)",
    };

    path.push(item);

    // If this is a session, we found one
    if (data.type === "session") {
      sessions.push({
        id: currentId,
        title: data.title,
        sessionDate: data.sessionDate?.toDate?.() || data.createdAt?.toDate?.(),
      });
      return; // Don't traverse further from sessions
    }

    // Follow "spawned" links backward
    const spawnedLinks = (data.linkedFrom || []).filter(
      (l) => l.type === "spawned"
    );

    for (const link of spawnedLinks) {
      await traverse(link.docId, depth + 1);
    }
  }

  try {
    await traverse(docId, 0);
    return { sessions, path };
  } catch (error) {
    return { sessions: [], path: [], error: error.message };
  }
}

/**
 * Get all items that originated from a session
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} sessionId - Session item ID
 * @returns {Promise<{items: Array, error?: string}>}
 */
async function getSessionTree(db, sessionId) {
  const collection = db.collection(COLLECTIONS.ITEMS);

  try {
    const sessionDoc = await collection.doc(sessionId).get();

    if (!sessionDoc.exists) {
      return { items: [], error: `Session not found: ${sessionId}` };
    }

    if (sessionDoc.data().type !== "session") {
      return { items: [], error: `Item ${sessionId} is not a session` };
    }

    // Find all items that link back to this session
    const items = [];
    const visited = new Set([sessionId]);

    async function collectDescendants(parentId) {
      const parentDoc = await collection.doc(parentId).get();
      if (!parentDoc.exists) return;

      const linksTo = parentDoc.data().linksTo || [];
      const spawnedLinks = linksTo.filter((l) => l.type === "spawned");

      for (const link of spawnedLinks) {
        if (visited.has(link.docId)) continue;
        visited.add(link.docId);

        const childDoc = await collection.doc(link.docId).get();
        if (childDoc.exists) {
          const data = childDoc.data();
          items.push({
            id: link.docId,
            type: data.type,
            title: data.title || "(untitled)",
            verdict: data.verdict,
            createdAt: data.createdAt?.toDate?.(),
          });

          // Recursively collect this item's descendants
          await collectDescendants(link.docId);
        }
      }
    }

    await collectDescendants(sessionId);

    // Sort by creation time
    items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    return { items };
  } catch (error) {
    return { items: [], error: error.message };
  }
}

export default {
  addLink,
  removeLink,
  getLinks,
  traceToSession,
  getSessionTree,
};
