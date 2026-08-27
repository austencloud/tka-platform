/**
 * Error Telemetry CLI
 *
 * Query and manage the errorTelemetry Firestore collection.
 * Auto-reported errors from the toast tier land here with deduplication.
 *
 * Usage:
 *   node scripts/error-telemetry.js list          Show unresolved errors by count
 *   node scripts/error-telemetry.js recent        Errors from the last 7 days
 *   node scripts/error-telemetry.js resolve <key> Mark an error as resolved
 *   node scripts/error-telemetry.js stats         Summary statistics
 */

import { initFirestore } from "./lib/firestore-provider.js";

const COLLECTION = "errorTelemetry";


function timeAgo(date) {
  if (!date) return "unknown";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function padRight(str, len) {
  return String(str).padEnd(len);
}

function padLeft(str, len) {
  return String(str).padStart(len);
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function listErrors(db, onlyRecent = false) {
  const col = db.collection(COLLECTION);
  let q = col.where("resolved", "==", false);

  if (onlyRecent) {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    q = q.where("lastSeen", ">=", cutoff);
  }

  const snapshot = await q.get();

  if (snapshot.empty) {
    console.log(onlyRecent ? "\n  No errors in the last 7 days.\n" : "\n  No unresolved errors.\n");
    return;
  }

  const errors = snapshot.docs
    .map((doc) => {
      const d = doc.data();
      return {
        key: d.key,
        count: d.count || 1,
        message: d.message,
        module: d.module || "unknown",
        action: d.action || "unknown",
        lastSeen: d.lastSeen?.toDate?.() ?? null,
        firstSeen: d.firstSeen?.toDate?.() ?? null,
      };
    })
    .sort((a, b) => b.count - a.count);

  const header = onlyRecent ? "Errors (last 7 days)" : "Unresolved Errors";
  console.log(`\n  ${header}\n`);
  console.log(
    `  ${padRight("#", 4)} ${padLeft("Count", 6)} ${padRight("Last Seen", 12)} ${padRight("Module", 12)} ${padRight("Message", 50)}`
  );
  console.log(`  ${"─".repeat(4)} ${"─".repeat(6)} ${"─".repeat(12)} ${"─".repeat(12)} ${"─".repeat(50)}`);

  errors.forEach((e, i) => {
    console.log(
      `  ${padRight(i + 1, 4)} ${padLeft(e.count, 6)} ${padRight(timeAgo(e.lastSeen), 12)} ${padRight(truncate(e.module, 12), 12)} ${truncate(e.message, 50)}`
    );
  });

  console.log(`\n  Total: ${errors.length} unique errors, ${errors.reduce((s, e) => s + e.count, 0)} occurrences\n`);
}

async function resolveError(db, key) {
  if (!key) {
    console.error("\n  Usage: node scripts/error-telemetry.js resolve <key>\n");
    console.error('  Key format: "message::module::action"');
    console.error('  Run "list" to see keys.\n');
    process.exit(1);
  }

  const col = db.collection(COLLECTION);
  const snapshot = await col.where("key", "==", key).where("resolved", "==", false).get();

  if (snapshot.empty) {
    console.error(`\n  No unresolved error found with key: "${key}"\n`);
    process.exit(1);
  }

  for (const doc of snapshot.docs) {
    await doc.ref.update({ resolved: true });
  }

  console.log(`\n  Resolved: "${truncate(key, 60)}"\n`);
}

async function showStats(db) {
  const col = db.collection(COLLECTION);

  const [unresolvedSnap, resolvedSnap] = await Promise.all([
    col.where("resolved", "==", false).get(),
    col.where("resolved", "==", true).get(),
  ]);

  const unresolved = unresolvedSnap.docs.map((d) => d.data());
  const resolved = resolvedSnap.docs.map((d) => d.data());

  const totalOccurrences = unresolved.reduce((s, e) => s + (e.count || 1), 0);

  console.log("\n  Error Telemetry Stats\n");
  console.log(`  Unresolved errors:    ${unresolved.length}`);
  console.log(`  Total occurrences:    ${totalOccurrences}`);
  console.log(`  Resolved errors:      ${resolved.length}`);

  if (unresolved.length > 0) {
    const top5 = unresolved
      .sort((a, b) => (b.count || 1) - (a.count || 1))
      .slice(0, 5);

    console.log("\n  Top 5 by count:");
    top5.forEach((e, i) => {
      console.log(`    ${i + 1}. [${e.count || 1}x] ${truncate(e.message, 50)} (${e.module})`);
    });
  }

  console.log();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2] || "list";
  const arg = process.argv.slice(3).join(" ");

  const { db } = await initFirestore();

  switch (command) {
    case "list":
      await listErrors(db, false);
      break;
    case "recent":
      await listErrors(db, true);
      break;
    case "resolve":
      await resolveError(db, arg);
      break;
    case "stats":
      await showStats(db);
      break;
    case "help":
      console.log(`
  Error Telemetry CLI

  Commands:
    list              Show all unresolved errors, sorted by count
    recent            Show errors from the last 7 days
    resolve <key>     Mark an error as resolved
    stats             Summary: unique errors, occurrences, top 5

  Key format: "message::module::action"
`);
      break;
    default:
      console.error(`\n  Unknown command: "${command}". Run with "help" for usage.\n`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
