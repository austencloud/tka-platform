#!/usr/bin/env node

/**
 * DI Migration Script
 *
 * Tracks progress of migrating from ITI dependency injection to direct singleton exports.
 * Uses a container-based claiming system for multi-agent coordination.
 *
 * Usage:
 *   node scripts/migrate-di.cjs                      # Show all containers and progress
 *   node scripts/migrate-di.cjs --auto-claim         # Claim next container to work on
 *   node scripts/migrate-di.cjs --claim <container>  # Claim specific container
 *   node scripts/migrate-di.cjs --release <container> # Release a claim
 *   node scripts/migrate-di.cjs --status <container> # Detailed status for container
 *   node scripts/migrate-di.cjs --mark-migrated <container> <service>  # Mark service done
 *   node scripts/migrate-di.cjs --complete <container>  # Mark container fully migrated
 *   node scripts/migrate-di.cjs --scan               # Re-scan containers
 *   node scripts/migrate-di.cjs --claims             # Show active claims
 *   node scripts/migrate-di.cjs --clear-expired      # Clear stale claims
 */

const fs = require("fs");
const path = require("path");

// Configuration
const CONTAINERS_DIR = path.join(__dirname, "..", "src", "lib", "shared", "di", "containers");
const TRACKER_FILE = path.join(__dirname, "..", ".di-migration-tracker.json");
const CLAIMS_FILE = path.join(__dirname, "..", ".di-migration-claims.json");
const LOCK_FILE = path.join(__dirname, "..", ".di-migration.lock");

// Timing
const CLAIM_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 30000;

// ============================================================================
// Locking
// ============================================================================

function acquireLock() {
  const startTime = Date.now();
  const myLockData = {
    pid: process.pid,
    timestamp: Date.now(),
    id: `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    try {
      if (fs.existsSync(LOCK_FILE)) {
        const lockContent = fs.readFileSync(LOCK_FILE, "utf-8");
        const lockData = JSON.parse(lockContent);

        if (Date.now() - lockData.timestamp > LOCK_STALE_MS) {
          fs.unlinkSync(LOCK_FILE);
        } else {
          const waitMs = 50 + Math.random() * 100;
          const waitUntil = Date.now() + waitMs;
          while (Date.now() < waitUntil) {}
          continue;
        }
      }

      fs.writeFileSync(LOCK_FILE, JSON.stringify(myLockData), { flag: "wx" });

      const verifyContent = fs.readFileSync(LOCK_FILE, "utf-8");
      const verifyData = JSON.parse(verifyContent);
      if (verifyData.id === myLockData.id) {
        return true;
      }
    } catch (err) {
      if (err.code === "EEXIST") {
        const waitMs = 50 + Math.random() * 100;
        const waitUntil = Date.now() + waitMs;
        while (Date.now() < waitUntil) {}
        continue;
      }
    }
  }

  console.error("❌ Could not acquire lock within timeout. Try again.");
  return false;
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {}
}

// ============================================================================
// Tracker Management
// ============================================================================

function readTracker() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      return JSON.parse(fs.readFileSync(TRACKER_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Warning: Could not read tracker file:", err.message);
  }
  return {
    containers: {},
    lastScan: null,
    stats: { totalMigrated: 0, totalRemaining: 0 },
  };
}

function writeTracker(data) {
  try {
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing tracker file:", err.message);
    return false;
  }
}

function readClaims() {
  try {
    if (fs.existsSync(CLAIMS_FILE)) {
      return JSON.parse(fs.readFileSync(CLAIMS_FILE, "utf-8"));
    }
  } catch (err) {}
  return {};
}

function writeClaims(claims) {
  try {
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing claims file:", err.message);
    return false;
  }
}

// ============================================================================
// Container Scanning
// ============================================================================

function scanContainers() {
  const containers = {};

  if (!fs.existsSync(CONTAINERS_DIR)) {
    console.error("❌ Containers directory not found:", CONTAINERS_DIR);
    return containers;
  }

  const files = fs.readdirSync(CONTAINERS_DIR);

  for (const file of files) {
    if (!file.endsWith("-container.ts")) continue;

    const containerName = file.replace("-container.ts", "");
    const filePath = path.join(CONTAINERS_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Extract service names from container
    // Look for patterns like: serviceName: () => new ServiceName(
    // or serviceName: () => serviceName (singleton reference)
    const services = [];
    const servicePattern = /^\s+(\w+):\s*\(\)/gm;
    let match;

    while ((match = servicePattern.exec(content)) !== null) {
      const serviceName = match[1];
      // Skip config/constant entries
      if (!serviceName.endsWith("Config") && serviceName !== "svgConfig") {
        services.push(serviceName);
      }
    }

    containers[containerName] = {
      file: file,
      path: filePath,
      services: services,
      migrated: [],
      status: "pending",
    };
  }

  return containers;
}

function mergeWithExisting(scanned, existing) {
  const merged = { ...scanned };

  for (const [name, data] of Object.entries(existing.containers || {})) {
    if (merged[name]) {
      // Preserve migration progress
      merged[name].migrated = data.migrated || [];
      merged[name].status = data.status || "pending";

      // Remove migrated services from the services list
      merged[name].services = merged[name].services.filter(
        (s) => !merged[name].migrated.includes(s)
      );
    } else if (data.status === "completed") {
      // Keep completed containers in the list
      merged[name] = data;
    }
  }

  return merged;
}

// ============================================================================
// Commands
// ============================================================================

function showStatus(containerFilter = null) {
  const tracker = readTracker();
  const claims = readClaims();

  // Scan for current state if no data
  if (!tracker.containers || Object.keys(tracker.containers).length === 0) {
    console.log("📡 Scanning containers...\n");
    const scanned = scanContainers();
    tracker.containers = scanned;
    tracker.lastScan = new Date().toISOString();
    writeTracker(tracker);
  }

  const containers = tracker.containers;

  if (containerFilter) {
    // Detailed view for one container
    const container = containers[containerFilter];
    if (!container) {
      console.error(`❌ Container not found: ${containerFilter}`);
      console.log("\nAvailable containers:");
      Object.keys(containers).forEach((c) => console.log(`  - ${c}`));
      return;
    }

    console.log(`\n📦 Container: ${containerFilter}`);
    console.log(`   File: ${container.file}`);
    console.log(`   Status: ${container.status}`);

    if (claims[containerFilter]) {
      const claim = claims[containerFilter];
      const age = Math.round((Date.now() - claim.timestamp) / 60000);
      console.log(`   Claimed: ${age} minutes ago`);
    }

    console.log(`\n   ✅ Migrated (${container.migrated?.length || 0}):`);
    (container.migrated || []).forEach((s) => console.log(`      - ${s}`));

    console.log(`\n   ⬜ Remaining (${container.services?.length || 0}):`);
    (container.services || []).forEach((s) => console.log(`      - ${s}`));

    return;
  }

  // Summary view
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║              DI MIGRATION PROGRESS                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  let totalMigrated = 0;
  let totalRemaining = 0;
  let completedContainers = 0;
  let inProgressContainers = 0;

  const rows = [];

  for (const [name, data] of Object.entries(containers)) {
    const migrated = data.migrated?.length || 0;
    const remaining = data.services?.length || 0;
    const total = migrated + remaining;
    const percent = total > 0 ? Math.round((migrated / total) * 100) : 100;

    totalMigrated += migrated;
    totalRemaining += remaining;

    if (data.status === "completed") {
      completedContainers++;
    } else if (migrated > 0) {
      inProgressContainers++;
    }

    const claimed = claims[name] ? "🔒" : "  ";
    const statusIcon =
      data.status === "completed" ? "✅" : migrated > 0 ? "🟡" : "⬜";

    rows.push({
      name,
      claimed,
      statusIcon,
      migrated,
      remaining,
      percent,
    });
  }

  // Sort: in-progress first, then pending, then completed
  rows.sort((a, b) => {
    if (a.statusIcon === "🟡" && b.statusIcon !== "🟡") return -1;
    if (b.statusIcon === "🟡" && a.statusIcon !== "🟡") return 1;
    if (a.statusIcon === "⬜" && b.statusIcon === "✅") return -1;
    if (b.statusIcon === "⬜" && a.statusIcon === "✅") return 1;
    return b.remaining - a.remaining;
  });

  console.log("Container                    Status  Progress");
  console.log("─".repeat(55));

  for (const row of rows) {
    const nameCol = (row.name + "-container").padEnd(28);
    const statusCol = `${row.claimed}${row.statusIcon}`.padEnd(6);
    const bar = progressBar(row.percent, 15);
    const nums = `${row.migrated}/${row.migrated + row.remaining}`;
    console.log(`${nameCol} ${statusCol} ${bar} ${nums}`);
  }

  console.log("─".repeat(55));
  console.log(
    `Total: ${totalMigrated} migrated, ${totalRemaining} remaining`
  );
  console.log(
    `Containers: ${completedContainers} done, ${inProgressContainers} in progress, ${
      rows.length - completedContainers - inProgressContainers
    } pending`
  );

  if (tracker.lastScan) {
    console.log(`\nLast scan: ${tracker.lastScan}`);
  }

  console.log("\n💡 Run with --auto-claim to start working on next container");
}

function progressBar(percent, width) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percent}%`;
}

function autoClaim() {
  if (!acquireLock()) return;

  try {
    const tracker = readTracker();
    const claims = readClaims();

    // Scan if needed
    if (!tracker.containers || Object.keys(tracker.containers).length === 0) {
      console.log("📡 Scanning containers...");
      const scanned = scanContainers();
      tracker.containers = scanned;
      tracker.lastScan = new Date().toISOString();
      writeTracker(tracker);
    }

    // Find next available container (not completed, not claimed)
    // Prioritize: in-progress > has most remaining services
    const candidates = [];

    for (const [name, data] of Object.entries(tracker.containers)) {
      if (data.status === "completed") continue;
      if (claims[name] && Date.now() - claims[name].timestamp < CLAIM_EXPIRY_MS) continue;

      const migrated = data.migrated?.length || 0;
      const remaining = data.services?.length || 0;

      candidates.push({
        name,
        migrated,
        remaining,
        inProgress: migrated > 0,
      });
    }

    if (candidates.length === 0) {
      console.log("🎉 All containers are either completed or claimed!");
      console.log("\nRun --claims to see active claims, or --status for overview.");
      return;
    }

    // Sort: in-progress first, then by remaining count
    candidates.sort((a, b) => {
      if (a.inProgress && !b.inProgress) return -1;
      if (b.inProgress && !a.inProgress) return 1;
      return b.remaining - a.remaining;
    });

    const chosen = candidates[0];

    // Claim it
    claims[chosen.name] = {
      timestamp: Date.now(),
      pid: process.pid,
    };
    writeClaims(claims);

    console.log(`\n✅ CLAIMED_CONTAINER: ${chosen.name}`);
    console.log(`   File: ${tracker.containers[chosen.name].file}`);
    console.log(`   Migrated: ${chosen.migrated}`);
    console.log(`   Remaining: ${chosen.remaining}`);

    // Show remaining services
    const services = tracker.containers[chosen.name].services || [];
    if (services.length > 0) {
      console.log("\n📋 Services to migrate:");
      services.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
    }

    console.log("\n💡 After migrating a service:");
    console.log(`   node scripts/migrate-di.cjs --mark-migrated ${chosen.name} <serviceName>`);
  } finally {
    releaseLock();
  }
}

function claimContainer(containerName) {
  if (!acquireLock()) return;

  try {
    const tracker = readTracker();
    const claims = readClaims();

    if (!tracker.containers?.[containerName]) {
      console.error(`❌ Container not found: ${containerName}`);
      return;
    }

    if (tracker.containers[containerName].status === "completed") {
      console.log(`✅ Container ${containerName} is already completed.`);
      return;
    }

    if (claims[containerName] && Date.now() - claims[containerName].timestamp < CLAIM_EXPIRY_MS) {
      const age = Math.round((Date.now() - claims[containerName].timestamp) / 60000);
      console.log(`⚠️  Container ${containerName} is already claimed (${age} min ago).`);
      return;
    }

    claims[containerName] = {
      timestamp: Date.now(),
      pid: process.pid,
    };
    writeClaims(claims);

    console.log(`✅ Claimed: ${containerName}`);
  } finally {
    releaseLock();
  }
}

function releaseContainer(containerName) {
  if (!acquireLock()) return;

  try {
    const claims = readClaims();

    if (!claims[containerName]) {
      console.log(`Container ${containerName} is not claimed.`);
      return;
    }

    delete claims[containerName];
    writeClaims(claims);

    console.log(`✅ Released: ${containerName}`);
  } finally {
    releaseLock();
  }
}

function markMigrated(containerName, serviceName) {
  const tracker = readTracker();

  if (!tracker.containers?.[containerName]) {
    console.error(`❌ Container not found: ${containerName}`);
    return;
  }

  const container = tracker.containers[containerName];

  // Initialize arrays if needed
  if (!container.migrated) container.migrated = [];
  if (!container.services) container.services = [];

  // Check if already migrated
  if (container.migrated.includes(serviceName)) {
    console.log(`Service ${serviceName} is already marked as migrated.`);
    return;
  }

  // Add to migrated
  container.migrated.push(serviceName);

  // Remove from services if present
  container.services = container.services.filter((s) => s !== serviceName);

  // Update status
  if (container.services.length === 0) {
    console.log(`\n🎉 All services in ${containerName} are migrated!`);
    console.log(`   Run: node scripts/migrate-di.cjs --complete ${containerName}`);
  }

  writeTracker(tracker);
  console.log(`✅ Marked as migrated: ${containerName} → ${serviceName}`);
  console.log(`   Remaining: ${container.services.length} services`);
}

function unmarkMigrated(containerName, serviceName) {
  const tracker = readTracker();

  if (!tracker.containers?.[containerName]) {
    console.error(`❌ Container not found: ${containerName}`);
    return;
  }

  const container = tracker.containers[containerName];

  if (!container.migrated?.includes(serviceName)) {
    console.log(`Service ${serviceName} is not in the migrated list.`);
    return;
  }

  container.migrated = container.migrated.filter((s) => s !== serviceName);
  if (!container.services) container.services = [];
  container.services.push(serviceName);

  writeTracker(tracker);
  console.log(`✅ Unmarked: ${serviceName} (moved back to pending)`);
}

function completeContainer(containerName) {
  const tracker = readTracker();
  const claims = readClaims();

  if (!tracker.containers?.[containerName]) {
    console.error(`❌ Container not found: ${containerName}`);
    return;
  }

  const container = tracker.containers[containerName];

  if (container.services?.length > 0) {
    console.log(`⚠️  Container still has ${container.services.length} unmigrated services:`);
    container.services.forEach((s) => console.log(`   - ${s}`));
    console.log("\nMark them as migrated first, or use --complete --force to override.");
    return;
  }

  container.status = "completed";
  container.completedAt = new Date().toISOString();

  // Release any claim
  delete claims[containerName];
  writeClaims(claims);
  writeTracker(tracker);

  console.log(`\n🎉 Container ${containerName} marked as COMPLETED!`);
  console.log("\nNext steps:");
  console.log(`   1. Delete: src/lib/shared/di/containers/${containerName}-container.ts`);
  console.log(`   2. Remove import from: src/lib/shared/di/index.ts`);
  console.log(`   3. Run: npm run check`);
}

function showClaims() {
  const claims = readClaims();

  if (Object.keys(claims).length === 0) {
    console.log("No active claims.");
    return;
  }

  console.log("\n🔒 Active Claims:\n");

  for (const [name, data] of Object.entries(claims)) {
    const age = Math.round((Date.now() - data.timestamp) / 60000);
    const expired = Date.now() - data.timestamp > CLAIM_EXPIRY_MS ? " (EXPIRED)" : "";
    console.log(`   ${name}: claimed ${age} min ago${expired}`);
  }
}

function clearExpired() {
  if (!acquireLock()) return;

  try {
    const claims = readClaims();
    let cleared = 0;

    for (const [name, data] of Object.entries(claims)) {
      if (Date.now() - data.timestamp > CLAIM_EXPIRY_MS) {
        delete claims[name];
        cleared++;
        console.log(`   Cleared: ${name}`);
      }
    }

    writeClaims(claims);
    console.log(`\n✅ Cleared ${cleared} expired claims.`);
  } finally {
    releaseLock();
  }
}

function rescan() {
  console.log("📡 Scanning containers...\n");

  const tracker = readTracker();
  const scanned = scanContainers();

  tracker.containers = mergeWithExisting(scanned, tracker);
  tracker.lastScan = new Date().toISOString();

  writeTracker(tracker);
  console.log(`✅ Found ${Object.keys(scanned).length} containers.`);
  showStatus();
}

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
DI Migration Script - Track progress eliminating dependency injection

Usage:
  node scripts/migrate-di.cjs                      Show status overview
  node scripts/migrate-di.cjs --auto-claim         Claim next container
  node scripts/migrate-di.cjs --status <name>      Detailed container status
  node scripts/migrate-di.cjs --claim <name>       Claim specific container
  node scripts/migrate-di.cjs --release <name>     Release a claim
  node scripts/migrate-di.cjs --mark-migrated <container> <service>
  node scripts/migrate-di.cjs --unmark <container> <service>
  node scripts/migrate-di.cjs --complete <name>    Mark container done
  node scripts/migrate-di.cjs --claims             Show active claims
  node scripts/migrate-di.cjs --clear-expired      Clear stale claims
  node scripts/migrate-di.cjs --scan               Re-scan containers
`);
  process.exit(0);
}

if (args.includes("--auto-claim")) {
  autoClaim();
} else if (args.includes("--claim")) {
  const idx = args.indexOf("--claim");
  const containerName = args[idx + 1];
  if (!containerName) {
    console.error("Usage: --claim <container-name>");
    process.exit(1);
  }
  claimContainer(containerName);
} else if (args.includes("--release")) {
  const idx = args.indexOf("--release");
  const containerName = args[idx + 1];
  if (!containerName) {
    console.error("Usage: --release <container-name>");
    process.exit(1);
  }
  releaseContainer(containerName);
} else if (args.includes("--mark-migrated")) {
  const idx = args.indexOf("--mark-migrated");
  const containerName = args[idx + 1];
  const serviceName = args[idx + 2];
  if (!containerName || !serviceName) {
    console.error("Usage: --mark-migrated <container-name> <service-name>");
    process.exit(1);
  }
  markMigrated(containerName, serviceName);
} else if (args.includes("--unmark")) {
  const idx = args.indexOf("--unmark");
  const containerName = args[idx + 1];
  const serviceName = args[idx + 2];
  if (!containerName || !serviceName) {
    console.error("Usage: --unmark <container-name> <service-name>");
    process.exit(1);
  }
  unmarkMigrated(containerName, serviceName);
} else if (args.includes("--complete")) {
  const idx = args.indexOf("--complete");
  const containerName = args[idx + 1];
  if (!containerName) {
    console.error("Usage: --complete <container-name>");
    process.exit(1);
  }
  completeContainer(containerName);
} else if (args.includes("--claims")) {
  showClaims();
} else if (args.includes("--clear-expired")) {
  clearExpired();
} else if (args.includes("--scan")) {
  rescan();
} else if (args.includes("--status")) {
  const idx = args.indexOf("--status");
  const containerName = args[idx + 1];
  showStatus(containerName);
} else {
  showStatus();
}
