/**
 * Museum Development Tracking System — CLI Router
 *
 * Thin CLI entry point that dispatches to domain modules.
 * All write operations live in museum-operations.js.
 * Firebase infrastructure lives in museum-firebase.js.
 * Linking and attachments have their own modules.
 *
 * Run `node scripts/museum-dev.js help` for all commands.
 */

import config from "../config/museum-dev.config.js";
import { admin, db, resolveAndValidateId, getJournalEntries, registerSession, addJournalEntry } from "./lib/museum-firebase.js";
import { createItem, updateItemStatus, setVerdict, answerQuestion, startSession, endSession, capture, addTag, removeTag } from "./lib/museum-operations.js";
import linking from "./lib/museum-linking.js";
import attachments from "./lib/museum-attachments.js";

const {
  ITEM_TYPES,
  ELEMENT_SUBTYPES,
  LINK_TYPES,
  VERDICT_TYPES,
  STATUSES,
  COLLECTIONS,
} = config;


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

    if (data.proposedBy) {
      console.log(`  Proposed By: ${data.proposedBy}`);
    }

    if (data.promotedToDecision) {
      const promotedAt = data.promotedAt?.toDate?.()?.toLocaleString() || "Unknown";
      console.log(`  Promoted: ${promotedAt}`);
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
      data.description.split("\n").forEach((line) => {
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

    let items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Client-side tag filter (avoids Firestore composite index requirement)
    if (options.tag) {
      items = items.filter((item) => (item.tags || []).includes(options.tag));
      if (items.length === 0) {
        console.log(`\n  No items found with tag "${options.tag}".\n`);
        return;
      }
    }

    // Count by status
    const counts = { new: 0, "in-progress": 0, "in-review": 0, completed: 0, archived: 0 };
    items.forEach((item) => {
      const status = item.status || "new";
      if (Object.hasOwn(counts, status)) {
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

    const TYPE_EMOJI = {
      session: "📝",
      decision: "⚖️",
      question: "❓",
      element: "🏛️",
      reference: "📚",
      proposal: "💡",
    };

    for (const [type, typeItems] of Object.entries(byType)) {
      const emoji = TYPE_EMOJI[type] || "📄";

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
// CASCADE DETECTION
// ============================================================================

async function cascadeCheck(shortId) {
  const fullId = await resolveAndValidateId(shortId);
  if (!fullId) return;

  const doc = await db.collection(COLLECTIONS.ITEMS).doc(fullId).get();
  if (!doc.exists) {
    console.log(`\n  ❌ Item not found: ${fullId}\n`);
    return;
  }

  const sourceData = doc.data();
  const sourceTitle = (sourceData.title || "(untitled)").substring(0, 60);
  console.log(`\n  🔗 CASCADE CHECK for: ${sourceTitle}`);
  console.log("=".repeat(70));

  // Phase 1: Walk explicit links (BFS)
  const visited = new Set([fullId]);
  const queue = [{ id: fullId, depth: 0 }];
  const linkedItems = [];

  while (queue.length > 0) {
    const { id: currentId, depth } = queue.shift();
    if (depth > 3) continue; // Max 3 hops

    const currentDoc = await db.collection(COLLECTIONS.ITEMS).doc(currentId).get();
    if (!currentDoc.exists) continue;
    const currentData = currentDoc.data();

    const allLinked = [
      ...(currentData.linksTo || []).map(l => ({ ...l, direction: "→" })),
      ...(currentData.linkedFrom || []).map(l => ({ ...l, direction: "←" })),
    ];

    for (const link of allLinked) {
      if (!visited.has(link.docId)) {
        visited.add(link.docId);
        const linkedDoc = await db.collection(COLLECTIONS.ITEMS).doc(link.docId).get();
        if (linkedDoc.exists) {
          const linkedData = linkedDoc.data();
          linkedItems.push({
            id: link.docId,
            depth: depth + 1,
            direction: link.direction,
            linkType: link.type,
            type: linkedData.type,
            status: linkedData.status,
            verdict: linkedData.verdict,
            title: linkedData.title,
          });
          queue.push({ id: link.docId, depth: depth + 1 });
        }
      }
    }
  }

  // Phase 2: Content-based search for related items
  // Extract key terms from the source item
  const sourceText = [sourceData.title || "", sourceData.description || ""].join(" ");
  // Core entities (always checked)
  const corePatterns = [
    { pattern: /K(?:'s)?/i, label: "K" },
    { pattern: /Order/i, label: "Order" },
    { pattern: /Lethe/i, label: "Lethe" },
    { pattern: /Scribe/i, label: "Scribe" },
  ];

  // Dynamic entities: scan all item titles for recurring proper nouns
  const allItems = await db.collection(COLLECTIONS.ITEMS).get();
  const nounCounts = new Map();
  const STOP_WORDS = new Set(["The", "This", "That", "What", "When", "Where", "Why", "How", "Not", "And", "But", "For", "From", "With", "Into", "Room", "Phase", "Wing", "Session", "Decision", "Question", "Proposal"]);

  allItems.forEach(d => {
    const title = d.data().title || "";
    const words = title.match(/[A-Z][a-z]{2,}/g) || [];
    for (const w of words) {
      if (!STOP_WORDS.has(w)) nounCounts.set(w, (nounCounts.get(w) || 0) + 1);
    }
  });

  // Build patterns from nouns appearing in 2+ item titles
  const dynamicPatterns = [];
  for (const [noun, count] of nounCounts) {
    if (count >= 2) {
      dynamicPatterns.push({ pattern: new RegExp("\\b" + noun + "\\b", "i"), label: noun });
    }
  }

  const entityPatterns = [...corePatterns, ...dynamicPatterns];
  const keyEntities = [];

  for (const ep of entityPatterns) {
    if (ep.pattern.test(sourceText)) {
      keyEntities.push(ep.label);
    }
  }

  let contentMatches = [];
  if (keyEntities.length > 0) {
    allItems.forEach(d => {
      if (visited.has(d.id)) return; // Already found via links
      const data = d.data();
      if (data.verdict === "superseded") return; // Skip superseded
      if (data.type === "session") return; // Skip sessions

      const text = [data.title || "", data.description || ""].join(" ");
      const matchedEntities = keyEntities.filter(entity => {
        const ep = entityPatterns.find(p => p.label === entity);
        return ep && ep.pattern.test(text);
      });

      if (matchedEntities.length >= 2) { // At least 2 shared entities
        contentMatches.push({
          id: d.id,
          type: data.type,
          status: data.status,
          verdict: data.verdict,
          title: data.title,
          matchedEntities,
        });
      }
    });

    // Sort by number of matched entities (most relevant first)
    contentMatches.sort((a, b) => b.matchedEntities.length - a.matchedEntities.length);
    contentMatches = contentMatches.slice(0, 30); // Cap at 30
  }

  // Display results
  console.log(`\n  📎 LINKED ITEMS (${linkedItems.length} found via link graph):\n`);

  if (linkedItems.length === 0) {
    console.log("     (none — this item has no explicit links)\n");
  } else {
    for (const item of linkedItems) {
      const indent = "  ".repeat(item.depth);
      const title = (item.title || "(untitled)").substring(0, 50);
      const verdict = item.verdict ? ` [${item.verdict}]` : "";
      console.log(
        `  ${indent}${item.direction} [${item.linkType}] ${item.id.substring(0, 8)}... | ${item.type} | ${title}${verdict}`
      );
    }
    console.log();
  }

  console.log(`  🔍 CONTENT MATCHES (${contentMatches.length} items share 2+ entities with source):\n`);

  if (contentMatches.length === 0) {
    console.log("     (none)\n");
  } else {
    console.log(`     Key entities in source: ${keyEntities.join(", ")}\n`);
    for (const item of contentMatches) {
      const title = (item.title || "(untitled)").substring(0, 45);
      const verdict = item.verdict ? ` [${item.verdict}]` : "";
      const entities = item.matchedEntities.join(",");
      console.log(
        `     ${item.id.substring(0, 8)}... | ${item.type.padEnd(10)} | ${title}${item.title?.length > 45 ? "..." : ""}${verdict} (${entities})`
      );
    }
    console.log();
  }

  const total = linkedItems.length + contentMatches.length;
  console.log("─".repeat(70));
  console.log(`  Total: ${total} potentially affected items`);
  console.log(`  Review these items if the source decision changes.\n`);
  console.log("=".repeat(70) + "\n");
}

// ============================================================================
// DISPLAY OPERATIONS (linking, journal, transcript, attachments)
// ============================================================================

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

async function showSessionTree(sessionId) {
  const fullId = await resolveAndValidateId(sessionId);
  if (!fullId) return;

  const result = await linking.getSessionTree(db, fullId);

  if (result.error) {
    console.log(`\n  ❌ ${result.error}\n`);
    return;
  }

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

  const JOURNAL_ICON = {
    created: "✨",
    claimed: "🔒",
    status_change: "📊",
    link_added: "🔗",
    link_removed: "✂️",
    verdict_set: "⚖️",
    transcript_attached: "📝",
    attachment_added: "📎",
    note: "📌",
  };

  entries.forEach((entry) => {
    const timestamp = entry.timestamp?.toLocaleString?.() || "Unknown";
    const icon = JOURNAL_ICON[entry.type] || "•";

    console.log(`\n  ${icon} ${entry.type} - ${timestamp}`);
    if (entry.message) {
      console.log(`     ${entry.message}`);
    }
  });

  console.log("\n" + "=".repeat(70) + "\n");
}

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
// PROPOSAL PROMOTION
// ============================================================================

async function promoteProposal(proposalId) {
  const fullId = await resolveAndValidateId(proposalId);
  if (!fullId) return false;

  const doc = await db.collection(COLLECTIONS.ITEMS).doc(fullId).get();
  if (!doc.exists) {
    console.log(`\n  ❌ Item not found: ${fullId}\n`);
    return false;
  }

  const data = doc.data();
  if (data.type !== "proposal") {
    console.log(`\n  ❌ Item is a ${data.type}, not a proposal. Only proposals can be promoted.\n`);
    return false;
  }

  if (data.promotedToDecision) {
    console.log(`\n  ⚠️  This proposal has already been promoted.\n`);
    return false;
  }

  await db.collection(COLLECTIONS.ITEMS).doc(fullId).update({
    type: "decision",
    promotedToDecision: true,
    promotedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    verdict: null,
    rationale: "",
  });

  await addJournalEntry(fullId, "status_change", `Promoted from proposal to decision`);

  console.log(`\n  ✅ Promoted to decision: ${data.title?.substring(0, 60)}...`);
  console.log(`     ID: ${fullId}\n`);

  return true;
}

// ============================================================================
// LINKING COMMANDS (thin wrappers around the linking module)
// ============================================================================

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

// ============================================================================
// ATTACHMENT COMMANDS (thin wrappers around the attachments module)
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

// ============================================================================
// HELP
// ============================================================================

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║              MUSEUM DEVELOPMENT TRACKING SYSTEM                      ║
╚══════════════════════════════════════════════════════════════════════╝

QUICK CAPTURE (during sessions):
  museum session "Title"              Start a new session
  museum capture <sessionId> decision "The decision"
  museum capture <sessionId> question "The question"
  museum session-end <sessionId> [--transcript <path>] [--strict]

QUEUE COMMANDS:
  museum                              List all items
  museum list                         List all items
  museum list --type decision         Filter by type
  museum list --status completed      Filter by status
  museum list --tag lore              Filter by tag
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

PROPOSALS:
  museum promote <proposalId>           Promote a proposal to a decision (user-directed only)

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

CASCADE:
  museum cascade <id>                 Show all items affected if this decision changes

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
// CLI ROUTER
// ============================================================================

const READ_ONLY_COMMANDS = new Set([
  "help", "--help", "-h", "list", "search", "journal", "transcript", "links", "trace", "tree", "cascade",
]);

async function main() {
  const args = process.argv.slice(2);

  // Only register session for write operations
  const isReadOnly =
    args.length === 0 ||
    READ_ONLY_COMMANDS.has(args[0]) ||
    (args[0]?.length >= 6 && (!args[1] || args[1] === "attachments"));

  if (!isReadOnly) {
    await registerSession();
  }

  if (args.length === 0 || args[0] === "list") {
    const options = {};
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--type" && args[i + 1]) {
        options.type = args[++i];
      } else if (args[i] === "--status" && args[i + 1]) {
        options.status = args[++i];
      } else if (args[i] === "--tag" && args[i + 1]) {
        options.tag = args[++i];
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

    case "session-end": {
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum session-end <sessionId> [--transcript <path>] [--strict]\n");
        return;
      }
      const transcriptIdx = args.indexOf("--transcript");
      const transcriptPath = transcriptIdx !== -1 ? args[transcriptIdx + 1] : null;
      const strict = args.includes("--strict");
      return endSession(args[1], transcriptPath, { strict });
    }

    case "capture":
      if (args.length < 4) {
        console.log("\n  ❌ Usage: museum capture <sessionId> <type> <content>\n");
        return;
      }
      return capture(args[1], args[2], args.slice(3).join(" "));

    case "create": {
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
    }

    case "promote":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum promote <proposalId>\n");
        console.log("  Promotes a proposal to a decision. Only use when the user explicitly directs it.\n");
        return;
      }
      return promoteProposal(args[1]);

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

    case "cascade":
      if (!args[1]) {
        console.log("\n  ❌ Usage: museum cascade <id>");
        console.log("  Shows all items that might be affected if this decision changes.\n");
        return;
      }
      return cascadeCheck(args[1]);

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
        if (!args[1]) {
          return getItemById(args[0]);
        }

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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n  ❌ Error:", error.message);
    process.exit(1);
  });
