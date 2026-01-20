#!/usr/bin/env node

/**
 * TIKA Conversations CLI
 *
 * Fetch and manage TIKA conversations from Firestore for review.
 *
 * Usage:
 *   node scripts/fetch-tika-conversations.cjs                    # List pending conversations
 *   node scripts/fetch-tika-conversations.cjs --status pending   # Filter by review status
 *   node scripts/fetch-tika-conversations.cjs <id>               # Show specific conversation
 *   node scripts/fetch-tika-conversations.cjs <id> claim         # Claim for review
 *   node scripts/fetch-tika-conversations.cjs <id> approve "Grade: notes"
 *   node scripts/fetch-tika-conversations.cjs <id> flag "notes"  # Needs human review
 *   node scripts/fetch-tika-conversations.cjs stats              # Show metrics
 */

const admin = require('firebase-admin');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// Firebase Setup
// ═══════════════════════════════════════════════════════════════════════════

let db = null;

async function initFirebase() {
  if (db) return db;

  // Load service account from local config
  const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');

  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    return db;
  } catch (error) {
    console.error('Firebase initialization failed.');
    console.error('Make sure firebase-service-account.json exists in the project root.');
    console.error('');
    console.error('To get the service account:');
    console.error('1. Go to Firebase Console > Project Settings > Service Accounts');
    console.error('2. Click "Generate new private key"');
    console.error('3. Save as firebase-service-account.json in project root');
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Access - Austen's conversations
// ═══════════════════════════════════════════════════════════════════════════

const AUSTEN_USER_ID = 'rnEi2kQQsNhbzKB9B8ICmZGlNtv2';

async function getReviewQueue(statusFilter = null, limit = 20) {
  const db = await initFirebase();
  const collectionRef = db.collection(`users/${AUSTEN_USER_ID}/tika_conversations`);

  let query = collectionRef.where('flaggedForReview', '==', true);

  if (statusFilter) {
    if (Array.isArray(statusFilter)) {
      query = collectionRef.where('reviewStatus', 'in', statusFilter);
    } else {
      query = collectionRef.where('reviewStatus', '==', statusFilter);
    }
  }

  query = query.orderBy('flaggedAt', 'desc').limit(limit);

  const snapshot = await query.get();
  const sessions = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    sessions.push({
      id: doc.id,
      title: data.title || 'Untitled',
      messageCount: data.messageCount || 0,
      lastUserMessage: data.lastUserMessage || '',
      flaggedAt: data.flaggedAt?.toDate(),
      reviewStatus: data.reviewStatus || 'pending',
      reviewMetadata: data.reviewMetadata ? {
        claimedAt: data.reviewMetadata.claimedAt?.toDate(),
        claimedBy: data.reviewMetadata.claimedBy,
        grade: data.reviewMetadata.grade,
        confidence: data.reviewMetadata.confidence,
        notes: data.reviewMetadata.notes,
        aiNotes: data.reviewMetadata.aiNotes,
        reviewedAt: data.reviewMetadata.reviewedAt?.toDate(),
      } : null,
      messages: data.messages || []
    });
  });

  return sessions;
}

async function getSession(sessionId) {
  const db = await initFirebase();
  const docRef = db.doc(`users/${AUSTEN_USER_ID}/tika_conversations/${sessionId}`);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || 'Untitled',
    messageCount: data.messageCount || 0,
    lastUserMessage: data.lastUserMessage || '',
    flaggedAt: data.flaggedAt?.toDate(),
    reviewStatus: data.reviewStatus || 'pending',
    reviewMetadata: data.reviewMetadata ? {
      claimedAt: data.reviewMetadata.claimedAt?.toDate(),
      claimedBy: data.reviewMetadata.claimedBy,
      grade: data.reviewMetadata.grade,
      confidence: data.reviewMetadata.confidence,
      notes: data.reviewMetadata.notes,
      aiNotes: data.reviewMetadata.aiNotes,
      correctedResponse: data.reviewMetadata.correctedResponse,
      reviewedAt: data.reviewMetadata.reviewedAt?.toDate(),
    } : null,
    messages: data.messages || []
  };
}

async function claimSession(sessionId) {
  const db = await initFirebase();
  const docRef = db.doc(`users/${AUSTEN_USER_ID}/tika_conversations/${sessionId}`);

  // Use transaction for atomic claim
  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error('Session not found');
      }

      const data = doc.data();

      // Check if already claimed by someone else
      if (data.reviewStatus === 'claimed' && data.reviewMetadata?.claimedBy !== 'claude-tika') {
        throw new Error('Already claimed by another reviewer');
      }

      // Claim it
      transaction.update(docRef, {
        reviewStatus: 'claimed',
        'reviewMetadata.claimedAt': admin.firestore.FieldValue.serverTimestamp(),
        'reviewMetadata.claimedBy': 'claude-tika',
      });

      return { ...data, id: doc.id };
    });

    return result;
  } catch (error) {
    console.error('Failed to claim:', error.message);
    return null;
  }
}

async function submitReview(sessionId, grade, confidence, notes, correctedResponse = null) {
  const db = await initFirebase();
  const docRef = db.doc(`users/${AUSTEN_USER_ID}/tika_conversations/${sessionId}`);

  // Determine status based on grade
  const gradeChar = grade.charAt(0).toUpperCase();
  const autoApprove = (gradeChar === 'A' || gradeChar === 'B') && confidence >= 85;

  let newStatus;
  if (autoApprove) {
    newStatus = 'approved';
  } else if (correctedResponse) {
    newStatus = 'needs-correction';
  } else {
    newStatus = 'in-review';
  }

  await docRef.update({
    reviewStatus: newStatus,
    'reviewMetadata.grade': grade,
    'reviewMetadata.confidence': confidence,
    'reviewMetadata.aiNotes': notes,
    'reviewMetadata.correctedResponse': correctedResponse || null,
    'reviewMetadata.reviewedAt': admin.firestore.FieldValue.serverTimestamp(),
  });

  return { status: newStatus, autoApprove };
}

async function flagForHumanReview(sessionId, notes) {
  const db = await initFirebase();
  const docRef = db.doc(`users/${AUSTEN_USER_ID}/tika_conversations/${sessionId}`);

  await docRef.update({
    reviewStatus: 'in-review',
    'reviewMetadata.aiNotes': notes,
    'reviewMetadata.reviewedAt': admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function archiveSession(sessionId) {
  const db = await initFirebase();
  const docRef = db.doc(`users/${AUSTEN_USER_ID}/tika_conversations/${sessionId}`);

  await docRef.update({
    reviewStatus: 'archived',
    flaggedForReview: false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Commands
// ═══════════════════════════════════════════════════════════════════════════

async function listSessions(statusFilter, limit = 20) {
  const sessions = await getReviewQueue(statusFilter, limit);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('TIKA REVIEW QUEUE');
  console.log('══════════════════════════════════════════════════════════════\n');

  if (sessions.length === 0) {
    console.log(statusFilter
      ? `No ${statusFilter} conversations found.`
      : 'No flagged conversations found.');
    console.log('\nTo flag a conversation, use the flag button in the Tika chat UI.');
    return;
  }

  // Count by status
  const counts = {
    pending: 0,
    claimed: 0,
    'in-review': 0,
    approved: 0,
    'needs-correction': 0,
    archived: 0
  };

  const allSessions = await getReviewQueue(null, 100);
  allSessions.forEach(s => {
    counts[s.reviewStatus] = (counts[s.reviewStatus] || 0) + 1;
  });

  console.log(`Pending: ${counts.pending} | In Review: ${counts['in-review'] + counts.claimed} | Approved: ${counts.approved} | Needs Fix: ${counts['needs-correction']}\n`);

  console.log('──────────────────────────────────────────────────────────────');

  sessions.forEach((session, i) => {
    const statusIcon = {
      pending: '🟡',
      claimed: '🔵',
      'in-review': '🟣',
      approved: '✅',
      'needs-correction': '🔴',
      archived: '📁'
    }[session.reviewStatus] || '❓';

    const grade = session.reviewMetadata?.grade
      ? ` [${session.reviewMetadata.grade}${session.reviewMetadata.confidence ? ` ${session.reviewMetadata.confidence}%` : ''}]`
      : '';

    console.log(`\n${i + 1}. ${statusIcon} ${session.title}${grade}`);
    console.log(`   ID: ${session.id}`);
    console.log(`   Messages: ${session.messageCount} | Flagged: ${session.flaggedAt?.toLocaleDateString() || 'Unknown'}`);
    console.log(`   Last: "${session.lastUserMessage.slice(0, 60)}${session.lastUserMessage.length > 60 ? '...' : ''}"`);

    if (session.reviewMetadata?.claimedBy) {
      console.log(`   Claimed by: ${session.reviewMetadata.claimedBy}`);
    }
  });

  console.log('\n══════════════════════════════════════════════════════════════\n');
}

async function showSession(sessionId) {
  const session = await getSession(sessionId);

  if (!session) {
    console.log(`Session not found: ${sessionId}`);
    return;
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`TIKA SESSION: ${session.title}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log(`ID: ${session.id}`);
  console.log(`Status: ${session.reviewStatus}`);
  console.log(`Messages: ${session.messageCount}`);
  console.log(`Flagged: ${session.flaggedAt?.toLocaleString() || 'Unknown'}`);

  if (session.reviewMetadata) {
    const rm = session.reviewMetadata;
    if (rm.grade) console.log(`Grade: ${rm.grade} (${rm.confidence}% confidence)`);
    if (rm.claimedBy) console.log(`Claimed by: ${rm.claimedBy}`);
    if (rm.notes) console.log(`Human Notes: ${rm.notes}`);
    if (rm.aiNotes) console.log(`AI Notes: ${rm.aiNotes}`);
  }

  console.log('\n── CONVERSATION ──────────────────────────────────────────────\n');

  session.messages.forEach(msg => {
    const role = msg.role === 'user' ? 'USER' : 'TIKA';
    let content = '';

    if (msg.parts) {
      const textPart = msg.parts.find(p => p.type === 'text');
      if (textPart && textPart.text) {
        content = textPart.text;
      }
    } else if (msg.content) {
      content = msg.content;
    }

    // Truncate long content
    if (content.length > 1000) {
      content = content.slice(0, 1000) + '... [truncated]';
    }

    console.log(`[${role}]`);
    console.log(content);
    console.log('');
  });

  if (session.reviewMetadata?.correctedResponse) {
    console.log('── SUGGESTED CORRECTION ──────────────────────────────────────\n');
    console.log(session.reviewMetadata.correctedResponse);
  }

  console.log('\n══════════════════════════════════════════════════════════════\n');

  // Output for scripting: print session ID on separate line for parsing
  console.log(`SESSION_ID:${session.id}`);
}

async function claim(sessionId) {
  console.log(`Claiming session ${sessionId}...`);

  const result = await claimSession(sessionId);

  if (result) {
    console.log(`✅ Claimed: ${sessionId}`);
    console.log(`CLAIMED_SESSION:${sessionId}`);
  } else {
    console.log(`❌ Failed to claim session`);
  }
}

async function approve(sessionId, gradeAndNotes) {
  // Parse "A (95%): notes" or "A: notes" format
  const match = gradeAndNotes.match(/^([A-F][+-]?)\s*(?:\((\d+)%\))?\s*:?\s*(.*)$/i);

  if (!match) {
    console.log('Invalid format. Use: approve "<Grade> (<confidence>%): <notes>"');
    console.log('Example: approve "A (95%): Accurate, natural tone"');
    return;
  }

  const grade = match[1].toUpperCase();
  const confidence = match[2] ? parseInt(match[2]) : 90;
  const notes = match[3] || '';

  const result = await submitReview(sessionId, grade, confidence, notes);

  if (result.autoApprove) {
    console.log(`✅ Auto-approved: ${sessionId}`);
  } else {
    console.log(`🟣 Marked for human review: ${sessionId}`);
  }

  console.log(`   Grade: ${grade} (${confidence}% confidence)`);
  console.log(`   Status: ${result.status}`);
  if (notes) console.log(`   Notes: ${notes}`);
}

async function flag(sessionId, notes) {
  await flagForHumanReview(sessionId, notes);

  console.log(`🚩 Flagged for human review: ${sessionId}`);
  if (notes) console.log(`   Notes: ${notes}`);
}

async function archive(sessionId) {
  await archiveSession(sessionId);
  console.log(`📁 Archived: ${sessionId}`);
}

async function showStats() {
  const sessions = await getReviewQueue(null, 100);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('TIKA REVIEW STATISTICS');
  console.log('══════════════════════════════════════════════════════════════\n');

  if (sessions.length === 0) {
    console.log('No flagged conversations found.');
    return;
  }

  // Count by status
  const counts = {
    pending: 0,
    claimed: 0,
    'in-review': 0,
    approved: 0,
    'needs-correction': 0,
    archived: 0
  };

  sessions.forEach(s => {
    counts[s.reviewStatus] = (counts[s.reviewStatus] || 0) + 1;
  });

  console.log('Status Breakdown:');
  console.log(`  🟡 Pending:          ${counts.pending}`);
  console.log(`  🔵 Claimed:          ${counts.claimed}`);
  console.log(`  🟣 In Review:        ${counts['in-review']}`);
  console.log(`  ✅ Approved:         ${counts.approved}`);
  console.log(`  🔴 Needs Correction: ${counts['needs-correction']}`);
  console.log(`  📁 Archived:         ${counts.archived}`);
  console.log(`  ─────────────────────`);
  console.log(`  Total:               ${sessions.length}`);

  // Grade distribution
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let graded = 0;

  sessions.forEach(s => {
    if (s.reviewMetadata?.grade) {
      const g = s.reviewMetadata.grade.charAt(0).toUpperCase();
      if (grades[g] !== undefined) {
        grades[g]++;
        graded++;
      }
    }
  });

  if (graded > 0) {
    console.log('\nGrade Distribution:');
    Object.entries(grades).forEach(([grade, count]) => {
      const bar = '█'.repeat(Math.round(count / graded * 20));
      console.log(`  ${grade}: ${count.toString().padStart(3)} ${bar}`);
    });
    console.log(`\n  Total graded: ${graded}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.length === 0) {
      // Default: list pending
      await listSessions('pending');
    } else if (args[0] === 'stats') {
      await showStats();
    } else if (args[0] === '--status') {
      await listSessions(args[1], parseInt(args[2]) || 20);
    } else if (args[0] === '--limit') {
      await listSessions(null, parseInt(args[1]) || 20);
    } else if (args[0] === '--all') {
      await listSessions(null, parseInt(args[1]) || 50);
    } else if (args[1] === 'claim') {
      await claim(args[0]);
    } else if (args[1] === 'approve') {
      await approve(args[0], args[2] || '');
    } else if (args[1] === 'flag') {
      await flag(args[0], args[2] || '');
    } else if (args[1] === 'archive') {
      await archive(args[0]);
    } else {
      // Assume it's a session ID
      await showSession(args[0]);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
