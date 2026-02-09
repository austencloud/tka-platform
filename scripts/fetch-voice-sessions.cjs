#!/usr/bin/env node

/**
 * Voice Sessions CLI
 *
 * Fetch and analyze voice command sessions from Firestore.
 * Used by the /voice-review Claude skill.
 *
 * Usage:
 *   node scripts/fetch-voice-sessions.cjs                     # List recent sessions
 *   node scripts/fetch-voice-sessions.cjs --limit 50          # List with custom limit
 *   node scripts/fetch-voice-sessions.cjs <id>                # Show specific session with events
 *   node scripts/fetch-voice-sessions.cjs <id> --format md    # Output as markdown (for AI analysis)
 *   node scripts/fetch-voice-sessions.cjs analyze             # Cross-session pattern analysis
 *   node scripts/fetch-voice-sessions.cjs analyze --limit 50  # Analyze more sessions
 *   node scripts/fetch-voice-sessions.cjs stats               # Quick stats summary
 */

const admin = require('firebase-admin');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// Firebase Setup
// ═══════════════════════════════════════════════════════════════════════════

let db = null;

async function initFirebase() {
  if (db) return db;

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
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Data Access
// ═══════════════════════════════════════════════════════════════════════════

const AUSTEN_USER_ID = 'rnEi2kQQsNhbzKB9B8ICmZGlNtv2';

async function listSessions(limit = 20) {
  const db = await initFirebase();
  const ref = db.collection(`users/${AUSTEN_USER_ID}/voiceSessions`);
  const snapshot = await ref.orderBy('startedAt', 'desc').limit(limit).get();

  if (snapshot.empty) {
    console.log('\n  No voice sessions found.\n');
    return [];
  }

  const sessions = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    sessions.push({ id: doc.id, ...data });
  });

  return sessions;
}

async function getSession(sessionId) {
  const db = await initFirebase();
  const ref = db.doc(`users/${AUSTEN_USER_ID}/voiceSessions/${sessionId}`);
  const doc = await ref.get();

  if (!doc.exists) {
    // Try partial ID match
    const allRef = db.collection(`users/${AUSTEN_USER_ID}/voiceSessions`);
    const snapshot = await allRef.get();
    let match = null;
    snapshot.forEach(d => {
      if (d.id.startsWith(sessionId)) {
        match = { id: d.id, ...d.data() };
      }
    });

    if (match) return match;
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  return { id: doc.id, ...doc.data() };
}

async function getFullSessions(limit = 20) {
  const db = await initFirebase();
  const ref = db.collection(`users/${AUSTEN_USER_ID}/voiceSessions`);
  const snapshot = await ref.orderBy('startedAt', 'desc').limit(limit).get();

  const sessions = [];
  snapshot.forEach(doc => {
    sessions.push({ id: doc.id, ...doc.data() });
  });
  return sessions;
}

// ═══════════════════════════════════════════════════════════════════════════
// Formatting
// ═══════════════════════════════════════════════════════════════════════════

function formatTimestamp(ts) {
  if (!ts) return 'unknown';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString();
}

function formatDuration(ms) {
  if (!ms) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${seconds}s`;
}

function tierColor(tier) {
  switch (tier) {
    case 'tier1_regex': return '\x1b[32m';  // green
    case 'tier2_llm': return '\x1b[34m';    // blue
    case 'tier3_chat': return '\x1b[35m';   // purple
    case 'unresolved': return '\x1b[31m';   // red
    default: return '\x1b[0m';
  }
}

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

// ═══════════════════════════════════════════════════════════════════════════
// Display: Session List
// ═══════════════════════════════════════════════════════════════════════════

function displaySessionList(sessions) {
  console.log(`\n${BOLD}Voice Sessions${RESET} (${sessions.length} found)\n`);
  console.log('══════════════════════════════════════════════════════════════════');

  for (const session of sessions) {
    const stats = session.stats || {};
    const total = stats.totalEvents || 0;
    const success = stats.successCount || 0;
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;

    const tierBreakdown = stats.tierBreakdown || {};
    const tierStr = Object.entries(tierBreakdown)
      .filter(([, count]) => count > 0)
      .map(([tier, count]) => `${tierColor(tier)}${tier.replace('tier', 'T').replace('_regex', '').replace('_llm', '').replace('_chat', '')}:${count}${RESET}`)
      .join(' ');

    console.log(`  ${BOLD}${session.id}${RESET}`);
    console.log(`    ${formatTimestamp(session.startedAt)} | ${formatDuration(session.durationMs)} | ${total} events | ${rate}% success`);
    if (tierStr) console.log(`    Tiers: ${tierStr}`);
    console.log('');
  }
  console.log('══════════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Display: Single Session Detail
// ═══════════════════════════════════════════════════════════════════════════

function displaySessionDetail(session, format = 'console') {
  if (format === 'md') {
    displaySessionMarkdown(session);
    return;
  }

  const stats = session.stats || {};
  console.log(`\n${BOLD}Voice Session: ${session.id}${RESET}`);
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  Started:  ${formatTimestamp(session.startedAt)}`);
  console.log(`  Duration: ${formatDuration(session.durationMs)}`);
  console.log(`  Events:   ${stats.totalEvents || 0} (${stats.successCount || 0} success, ${stats.failureCount || 0} failed, ${stats.unresolvedCount || 0} unresolved)`);
  console.log(`  Avg latency: ${stats.avgLatencyMs ? Math.round(stats.avgLatencyMs) + 'ms' : 'N/A'}`);
  console.log('──────────────────────────────────────────────────────────────────');

  const events = session.events || [];
  if (events.length === 0) {
    console.log('  (No events recorded)');
  }

  for (const event of events) {
    const tierLabel = event.tier || 'unknown';
    const color = tierColor(tierLabel);
    const cmd = event.interpretedCommand;
    const cmdStr = cmd ? `${cmd.category}:${cmd.action}(${cmd.target})` : '(none)';
    const resultStr = event.dispatchResult
      ? (event.dispatchResult.success ? 'OK' : `FAIL: ${event.dispatchResult.message}`)
      : '(no dispatch)';

    console.log(`\n  ${DIM}[${formatDuration(event.offsetMs)}]${RESET} ${color}${tierLabel}${RESET} | ${event.latencyMs}ms`);
    console.log(`    Transcript: "${event.transcript}" (conf: ${(event.speechConfidence * 100).toFixed(0)}%)`);
    console.log(`    Command:    ${cmdStr}`);
    console.log(`    Result:     ${resultStr}`);
    console.log(`    Context:    ${event.context?.module || '?'}/${event.context?.tab || '?'}`);

    if (event.llmDetails) {
      console.log(`    LLM:        conf=${(event.llmDetails.confidence * 100).toFixed(0)}% cmds=${event.llmDetails.commandCount} escalated=${event.llmDetails.escalatedToChat}`);
    }
    if (event.chatDetails) {
      console.log(`    Chat:       "${event.chatDetails.responseText?.substring(0, 80)}..."`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════\n');
}

function displaySessionMarkdown(session) {
  const stats = session.stats || {};
  const events = session.events || [];

  console.log(`# Voice Session: ${session.id}\n`);
  console.log(`- **Date:** ${formatTimestamp(session.startedAt)}`);
  console.log(`- **Duration:** ${formatDuration(session.durationMs)}`);
  console.log(`- **Events:** ${stats.totalEvents || 0} total, ${stats.successCount || 0} success, ${stats.failureCount || 0} failed, ${stats.unresolvedCount || 0} unresolved`);
  console.log(`- **Avg Latency:** ${stats.avgLatencyMs ? Math.round(stats.avgLatencyMs) + 'ms' : 'N/A'}`);

  const tierBreakdown = stats.tierBreakdown || {};
  if (Object.keys(tierBreakdown).length > 0) {
    console.log(`\n## Tier Breakdown\n`);
    console.log(`| Tier | Count |`);
    console.log(`|------|-------|`);
    for (const [tier, count] of Object.entries(tierBreakdown)) {
      if (count > 0) console.log(`| ${tier} | ${count} |`);
    }
  }

  console.log(`\n## Events\n`);
  for (const event of events) {
    const cmd = event.interpretedCommand;
    const cmdStr = cmd ? `${cmd.category}:${cmd.action}(${cmd.target})` : 'none';
    const resultStr = event.dispatchResult
      ? (event.dispatchResult.success ? 'OK' : `FAIL: ${event.dispatchResult.message}`)
      : 'no dispatch';

    console.log(`### Event ${event.index + 1} [${event.tier}] +${formatDuration(event.offsetMs)}\n`);
    console.log(`- **Transcript:** "${event.transcript}" (conf: ${(event.speechConfidence * 100).toFixed(0)}%)`);
    console.log(`- **Command:** ${cmdStr}`);
    console.log(`- **Result:** ${resultStr}`);
    console.log(`- **Latency:** ${event.latencyMs}ms`);
    console.log(`- **Context:** ${event.context?.module || '?'}/${event.context?.tab || '?'}`);
    if (event.llmDetails) {
      console.log(`- **LLM:** conf=${(event.llmDetails.confidence * 100).toFixed(0)}%, commands=${event.llmDetails.commandCount}, escalated=${event.llmDetails.escalatedToChat}`);
    }
    console.log('');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Analysis
// ═══════════════════════════════════════════════════════════════════════════

function analyzePatterns(sessions) {
  console.log(`\n${BOLD}Cross-Session Analysis${RESET} (${sessions.length} sessions)\n`);
  console.log('══════════════════════════════════════════════════════════════════');

  const allEvents = sessions.flatMap(s => s.events || []);
  const total = allEvents.length;

  if (total === 0) {
    console.log('  No events to analyze.\n');
    return;
  }

  // Tier distribution
  const tierCounts = {};
  for (const event of allEvents) {
    tierCounts[event.tier] = (tierCounts[event.tier] || 0) + 1;
  }

  console.log(`\n  ${BOLD}Tier Distribution${RESET} (${total} events)\n`);
  for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`    ${tierColor(tier)}${tier.padEnd(15)}${RESET} ${String(count).padStart(4)} (${pct}%) ${bar}`);
  }

  // Top failing transcripts
  const failMap = new Map();
  for (const event of allEvents) {
    if (event.tier === 'unresolved' || event.dispatchResult?.success === false) {
      const normalized = event.transcript.toLowerCase().trim();
      failMap.set(normalized, (failMap.get(normalized) || 0) + 1);
    }
  }

  if (failMap.size > 0) {
    const sorted = [...failMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`\n  ${BOLD}Top Failing Transcripts${RESET}\n`);
    for (const [transcript, count] of sorted) {
      console.log(`    ${count}x  "${transcript}"`);
    }
  }

  // T2 candidates (consistent LLM interpretations)
  const t2Map = new Map();
  for (const event of allEvents) {
    if (event.tier === 'tier2_llm' && event.interpretedCommand) {
      const normalized = event.transcript.toLowerCase().trim();
      const cmdKey = `${event.interpretedCommand.category}:${event.interpretedCommand.action}:${event.interpretedCommand.target}`;
      const key = `${normalized}|||${cmdKey}`;
      t2Map.set(key, (t2Map.get(key) || 0) + 1);
    }
  }

  const t2Candidates = [...t2Map.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (t2Candidates.length > 0) {
    console.log(`\n  ${BOLD}T2 Promotion Candidates${RESET} (3+ consistent LLM resolutions)\n`);
    for (const [key, count] of t2Candidates) {
      const [transcript, cmdKey] = key.split('|||');
      console.log(`    ${count}x  "${transcript}" -> ${cmdKey}`);
    }
  }

  // Unresolved patterns
  const unresolvedMap = new Map();
  for (const event of allEvents) {
    if (event.tier === 'unresolved') {
      const normalized = event.transcript.toLowerCase().trim();
      unresolvedMap.set(normalized, (unresolvedMap.get(normalized) || 0) + 1);
    }
  }

  if (unresolvedMap.size > 0) {
    const sorted = [...unresolvedMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`\n  ${BOLD}Unresolved Patterns${RESET}\n`);
    for (const [transcript, count] of sorted) {
      console.log(`    ${count}x  "${transcript}"`);
    }
  }

  // Latency by tier
  const latencyByTier = new Map();
  for (const event of allEvents) {
    const existing = latencyByTier.get(event.tier);
    if (existing) {
      existing.sum += event.latencyMs;
      existing.min = Math.min(existing.min, event.latencyMs);
      existing.max = Math.max(existing.max, event.latencyMs);
      existing.count++;
    } else {
      latencyByTier.set(event.tier, {
        sum: event.latencyMs,
        min: event.latencyMs,
        max: event.latencyMs,
        count: 1,
      });
    }
  }

  console.log(`\n  ${BOLD}Latency by Tier${RESET}\n`);
  for (const [tier, data] of latencyByTier) {
    const avg = Math.round(data.sum / data.count);
    console.log(`    ${tierColor(tier)}${tier.padEnd(15)}${RESET} avg=${avg}ms  min=${data.min}ms  max=${data.max}ms  (${data.count} samples)`);
  }

  // Success rate trend
  console.log(`\n  ${BOLD}Success Rate Trend${RESET}\n`);
  const sortedSessions = [...sessions].sort((a, b) => {
    const aTime = a.startedAt?.toDate ? a.startedAt.toDate().getTime() : new Date(a.startedAt).getTime();
    const bTime = b.startedAt?.toDate ? b.startedAt.toDate().getTime() : new Date(b.startedAt).getTime();
    return aTime - bTime;
  });

  for (const session of sortedSessions) {
    const stats = session.stats || {};
    const total = stats.totalEvents || 0;
    const rate = total > 0 ? Math.round((stats.successCount / total) * 100) : 0;
    const bar = '█'.repeat(Math.round(rate / 3.33));
    console.log(`    ${formatTimestamp(session.startedAt).padEnd(22)} ${String(rate).padStart(3)}% ${bar}  (${total} events)`);
  }

  console.log('\n══════════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════════════════

function displayStats(sessions) {
  console.log(`\n${BOLD}Voice Session Stats${RESET}\n`);
  console.log('══════════════════════════════════════════════════════════════════');

  const total = sessions.length;
  const allEvents = sessions.flatMap(s => s.events || []);
  const totalEvents = allEvents.length;
  const successEvents = allEvents.filter(e => e.tier !== 'unresolved' && e.dispatchResult?.success !== false).length;
  const overallRate = totalEvents > 0 ? Math.round((successEvents / totalEvents) * 100) : 0;

  console.log(`  Sessions:       ${total}`);
  console.log(`  Total events:   ${totalEvents}`);
  console.log(`  Overall success: ${overallRate}%`);
  console.log(`  Avg events/session: ${total > 0 ? Math.round(totalEvents / total) : 0}`);

  const totalDuration = sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0);
  console.log(`  Total recording time: ${formatDuration(totalDuration)}`);

  console.log('\n══════════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let limit = 20;
  let format = 'console';
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1];
      i++;
    } else {
      positional.push(args[i]);
    }
  }

  const command = positional[0];

  if (!command) {
    // List sessions
    const sessions = await listSessions(limit);
    if (sessions.length > 0) displaySessionList(sessions);
    return;
  }

  if (command === 'stats') {
    const sessions = await getFullSessions(limit);
    displayStats(sessions);
    return;
  }

  if (command === 'analyze') {
    const sessions = await getFullSessions(limit);
    analyzePatterns(sessions);
    return;
  }

  // Specific session by ID
  const session = await getSession(command);
  displaySessionDetail(session, format);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
