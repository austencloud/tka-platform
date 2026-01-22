#!/usr/bin/env node

/**
 * Dead Code Detection Script
 *
 * Finds unused exports, orphan files, and abandoned code in the codebase.
 * Uses a scope-based claiming system for multi-agent coordination.
 *
 * Usage:
 *   node scripts/find-deadcode.cjs                    # Show top dead code items
 *   node scripts/find-deadcode.cjs --auto-claim       # Claim next scope and show items
 *   node scripts/find-deadcode.cjs --claim <scope>    # Claim specific scope
 *   node scripts/find-deadcode.cjs --release <scope>  # Release a claim
 *   node scripts/find-deadcode.cjs --list             # List all scopes with status
 *   node scripts/find-deadcode.cjs --claims           # Show active claims
 *   node scripts/find-deadcode.cjs --stats            # Summary statistics
 *   node scripts/find-deadcode.cjs --false-positive <path>  # Mark as false positive
 *   node scripts/find-deadcode.cjs --clear-expired    # Clear expired claims
 *
 * Scopes are feature-level: features/create, features/feedback, shared/pictograph, etc.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const SRC_DIR = path.join(__dirname, "..", "src");
const LIB_DIR = path.join(SRC_DIR, "lib");
const TRACKER_FILE = path.join(__dirname, "..", ".deadcode-tracker.json");
const CLAIMS_FILE = path.join(__dirname, "..", ".deadcode-claims.json");
const LOCK_FILE = path.join(__dirname, "..", ".deadcode-claims.lock");

// Timing
const CLAIM_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours
const LOCK_TIMEOUT_MS = 5000; // 5 seconds to acquire lock
const LOCK_STALE_MS = 30000; // Lock is stale after 30 seconds

// Detection configuration
const EXTENSIONS = [".ts", ".svelte"];
const IGNORE_PATTERNS = [
  /\.d\.ts$/, // Type declaration files
  /\.test\.ts$/, // Test files
  /\.spec\.ts$/, // Test files
  /\+page\.svelte$/, // SvelteKit pages
  /\+layout\.svelte$/, // SvelteKit layouts
  /\+server\.ts$/, // SvelteKit server routes
  /\+page\.ts$/, // SvelteKit page load
  /\+layout\.ts$/, // SvelteKit layout load
  /\/routes\//, // Route files (entry points)
  /app\.css$/, // Global styles
  /app\.html$/, // HTML template
];

// Known entry points that won't be imported but are used
const ENTRY_POINTS = [
  "src/lib/shared/di/index.ts", // DI container entry
  "src/lib/shared/di/containers/", // Container registrations
  "src/hooks.server.ts",
  "src/hooks.client.ts",
];

// ============================================================================
// Locking (copied from find-monoliths.cjs for consistency)
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
    scopes: {},
    items: {},
    falsePositives: [],
    stats: { totalRemoved: 0, totalDeferred: 0, lastScan: null },
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
  return { claims: {} };
}

function writeClaims(data) {
  try {
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing claims file:", err.message);
    return false;
  }
}

function isExpired(claim) {
  const claimedAt = new Date(claim.claimedAt).getTime();
  return Date.now() - claimedAt > CLAIM_EXPIRY_MS;
}

// ============================================================================
// Scope Discovery
// ============================================================================

function discoverScopes() {
  const scopes = [];

  // Features
  const featuresDir = path.join(LIB_DIR, "features");
  if (fs.existsSync(featuresDir)) {
    for (const feature of fs.readdirSync(featuresDir)) {
      const featurePath = path.join(featuresDir, feature);
      if (fs.statSync(featurePath).isDirectory()) {
        scopes.push(`features/${feature}`);
      }
    }
  }

  // Shared modules
  const sharedDir = path.join(LIB_DIR, "shared");
  if (fs.existsSync(sharedDir)) {
    for (const module of fs.readdirSync(sharedDir)) {
      const modulePath = path.join(sharedDir, module);
      if (fs.statSync(modulePath).isDirectory()) {
        scopes.push(`shared/${module}`);
      }
    }
  }

  return scopes.sort();
}

function getScopePath(scope) {
  return path.join(LIB_DIR, scope);
}

function getScopeFileCount(scope) {
  const scopePath = getScopePath(scope);
  if (!fs.existsSync(scopePath)) return 0;

  let count = 0;
  function countFiles(dir) {
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        countFiles(fullPath);
      } else if (EXTENSIONS.some((ext) => item.endsWith(ext))) {
        count++;
      }
    }
  }
  countFiles(scopePath);
  return count;
}

// ============================================================================
// Dead Code Detection
// ============================================================================

function findAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!item.startsWith(".") && item !== "node_modules") {
        findAllFiles(fullPath, files);
      }
    } else if (EXTENSIONS.some((ext) => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function shouldIgnoreFile(filePath) {
  const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, "/");

  // Check ignore patterns
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(relativePath)) return true;
  }

  // Check entry points
  for (const entry of ENTRY_POINTS) {
    if (relativePath.startsWith(entry.replace("src/", ""))) return true;
  }

  return false;
}

function extractExports(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const exports = [];

  // Named exports: export const/let/function/class/interface/type NAME
  const namedExportRegex =
    /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push({ name: match[1], type: "named" });
  }

  // Export default
  if (/export\s+default\s/.test(content)) {
    exports.push({ name: "default", type: "default" });
  }

  // Re-exports: export { X } from './Y'
  const reExportRegex = /export\s*\{([^}]+)\}\s*from/g;
  while ((match = reExportRegex.exec(content)) !== null) {
    const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim());
    for (const name of names) {
      if (name) exports.push({ name, type: "re-export" });
    }
  }

  return exports;
}

function isFileImported(filePath, allFiles) {
  const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, "/");
  const fileName = path.basename(filePath);
  const fileNameNoExt = fileName.replace(/\.(ts|svelte)$/, "");

  // Build import patterns to search for
  const patterns = [
    // Direct path imports
    relativePath.replace(/^lib\//, "$lib/"),
    relativePath.replace(/^lib\//, "../").replace(/\.(ts|svelte)$/, ""),
    fileNameNoExt,
    `./${fileNameNoExt}`,
    `/${fileNameNoExt}`,
  ];

  // For Svelte components, also check for component usage in templates
  if (filePath.endsWith(".svelte")) {
    const componentName = fileNameNoExt;
    patterns.push(`<${componentName}`);
  }

  // Check if any file imports this one
  for (const otherFile of allFiles) {
    if (otherFile === filePath) continue;

    const content = fs.readFileSync(otherFile, "utf-8");

    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

function scanScope(scope) {
  const scopePath = getScopePath(scope);
  if (!fs.existsSync(scopePath)) {
    console.error(`❌ Scope not found: ${scope}`);
    return [];
  }

  const tracker = readTracker();
  const allFiles = findAllFiles(SRC_DIR);
  const scopeFiles = findAllFiles(scopePath);
  const deadItems = [];

  for (const filePath of scopeFiles) {
    // Skip ignored files
    if (shouldIgnoreFile(filePath)) continue;

    const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, "/");

    // Skip known false positives
    if (tracker.falsePositives?.includes(relativePath)) continue;

    // Skip already processed items
    const existingItem = tracker.items?.[relativePath];
    if (existingItem && ["removed", "false-positive"].includes(existingItem.status)) {
      continue;
    }

    // Check if the file is imported anywhere
    const isImported = isFileImported(filePath, allFiles);

    if (!isImported) {
      const exports = extractExports(filePath);
      const stat = fs.statSync(filePath);
      const lines = fs.readFileSync(filePath, "utf-8").split("\n").length;

      // Calculate confidence
      let confidence = 0.9; // Base confidence for unimported file

      // Higher confidence for files with no exports (utility-less)
      if (exports.length === 0) confidence = 0.95;

      // Lower confidence for interface/type files (might be used via re-exports)
      if (exports.every((e) => ["interface", "type"].includes(e.type))) {
        confidence = 0.7;
      }

      // Lower confidence for index files
      if (path.basename(filePath) === "index.ts") {
        confidence = 0.6;
      }

      deadItems.push({
        path: relativePath,
        fullPath: filePath,
        scope,
        lines,
        exports: exports.map((e) => e.name),
        lastModified: stat.mtime.toISOString().split("T")[0],
        confidence,
        reason: "No imports found in codebase",
      });
    }
  }

  // Sort by confidence (highest first), then by lines (largest first)
  deadItems.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.lines - a.lines;
  });

  return deadItems;
}

// ============================================================================
// Commands
// ============================================================================

function listScopes() {
  const scopes = discoverScopes();
  const tracker = readTracker();
  const claims = readClaims();

  console.log("\n📁 Available Scopes:\n");
  console.log("┌────────────────────────────────────┬───────┬──────────┬─────────────┐");
  console.log("│ Scope                              │ Files │ Status   │ Dead Found  │");
  console.log("├────────────────────────────────────┼───────┼──────────┼─────────────┤");

  let totalFiles = 0;
  let totalDead = 0;
  let scannedCount = 0;

  for (const scope of scopes) {
    const fileCount = getScopeFileCount(scope);
    totalFiles += fileCount;

    const scopeData = tracker.scopes?.[scope];
    const claim = claims.claims?.[scope];
    const isClaimed = claim && !isExpired(claim);

    let status = "pending";
    let deadCount = "-";

    if (isClaimed) {
      status = "🔒 claimed";
    } else if (scopeData?.status === "complete") {
      status = "✅ done";
      deadCount = String(scopeData.deadCount || 0);
      totalDead += scopeData.deadCount || 0;
      scannedCount++;
    } else if (scopeData?.status === "partial") {
      status = "⏸️ partial";
      deadCount = String(scopeData.deadCount || 0);
    }

    const scopeCol = scope.padEnd(34);
    const filesCol = String(fileCount).padStart(5);
    const statusCol = status.padEnd(8);
    const deadCol = deadCount.padStart(11);

    console.log(`│ ${scopeCol} │ ${filesCol} │ ${statusCol} │ ${deadCol} │`);
  }

  console.log("└────────────────────────────────────┴───────┴──────────┴─────────────┘");
  console.log(
    `\n📊 Summary: ${scopes.length} scopes, ${totalFiles} files, ${scannedCount} scanned, ${totalDead} dead items found\n`
  );
}

function showClaims() {
  const claims = readClaims();
  const entries = Object.entries(claims.claims);

  if (entries.length === 0) {
    console.log("\n📋 No active claims.\n");
    return;
  }

  console.log("\n📋 Active Claims:\n");

  let activeCount = 0;
  let expiredCount = 0;

  for (const [scope, claim] of entries) {
    const expired = isExpired(claim);
    const icon = expired ? "⏰" : "🔒";
    const status = expired ? "EXPIRED" : "active";

    if (expired) expiredCount++;
    else activeCount++;

    console.log(`${icon} ${scope}`);
    console.log(`   Status: ${status}`);
    console.log(`   Claimed: ${new Date(claim.claimedAt).toLocaleString()}`);
    if (!expired) {
      const expiresIn = Math.round(
        (CLAIM_EXPIRY_MS - (Date.now() - new Date(claim.claimedAt).getTime())) / 60000
      );
      console.log(`   Expires in: ${expiresIn} minutes`);
    }
    console.log("");
  }

  console.log(`Summary: ${activeCount} active, ${expiredCount} expired`);
  if (expiredCount > 0) {
    console.log(`Use --clear-expired to remove expired claims.\n`);
  }
}

function clearExpiredClaims() {
  const claims = readClaims();
  const before = Object.keys(claims.claims).length;

  for (const [scope, claim] of Object.entries(claims.claims)) {
    if (isExpired(claim)) {
      delete claims.claims[scope];
    }
  }

  const after = Object.keys(claims.claims).length;
  const removed = before - after;

  if (removed > 0) {
    writeClaims(claims);
    console.log(`\n🧹 Cleared ${removed} expired claim(s).\n`);
  } else {
    console.log("\n✨ No expired claims to clear.\n");
  }
}

function claimScope(scope) {
  const claims = readClaims();

  // Check if already claimed
  if (claims.claims[scope]) {
    const existing = claims.claims[scope];
    if (!isExpired(existing)) {
      console.log(`\n❌ Scope already claimed: ${scope}`);
      console.log(`   Claimed at: ${existing.claimedAt}`);
      console.log(`\n   Use --release to free this claim if needed.\n`);
      return false;
    }
    console.log(`\n⏰ Previous claim expired, claiming scope...\n`);
  }

  // Verify scope exists
  if (!fs.existsSync(getScopePath(scope))) {
    console.log(`\n❌ Scope not found: ${scope}`);
    console.log(`   Run --list to see available scopes.\n`);
    return false;
  }

  claims.claims[scope] = {
    claimedAt: new Date().toISOString(),
    agentId: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };

  if (writeClaims(claims)) {
    console.log(`\n✅ Claimed scope: ${scope}`);
    console.log(`   Expires: ${new Date(Date.now() + CLAIM_EXPIRY_MS).toLocaleTimeString()}\n`);
    return true;
  }
  return false;
}

function releaseScope(scope) {
  const claims = readClaims();

  if (!claims.claims[scope]) {
    console.log(`\n⚠️  No claim found for: ${scope}\n`);
    return false;
  }

  delete claims.claims[scope];

  if (writeClaims(claims)) {
    console.log(`\n✅ Released claim: ${scope}\n`);
    return true;
  }
  return false;
}

function autoClaimScope() {
  console.log("\n🔒 Auto-claim mode: Finding next unclaimed scope...\n");

  if (!acquireLock()) {
    process.exit(1);
  }

  try {
    const scopes = discoverScopes();
    const tracker = readTracker();
    const claims = readClaims();

    // Find first scope that isn't done and isn't claimed
    let targetScope = null;
    for (const scope of scopes) {
      const scopeData = tracker.scopes?.[scope];
      const claim = claims.claims?.[scope];
      const isClaimed = claim && !isExpired(claim);

      if (!isClaimed && scopeData?.status !== "complete") {
        targetScope = scope;
        break;
      }
    }

    if (!targetScope) {
      console.log("⚠️  No available scopes to claim.");
      console.log("   All scopes are either complete or claimed.\n");
      releaseLock();
      process.exit(1);
    }

    // Claim it
    claims.claims[targetScope] = {
      claimedAt: new Date().toISOString(),
      agentId: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    if (!writeClaims(claims)) {
      console.error("❌ Failed to write claim.\n");
      releaseLock();
      process.exit(1);
    }

    const fileCount = getScopeFileCount(targetScope);
    console.log(`✅ Claimed: ${targetScope}`);
    console.log(`   Files: ${fileCount}`);
    console.log(`   Expires: ${new Date(Date.now() + CLAIM_EXPIRY_MS).toLocaleTimeString()}`);
    console.log(`\n📄 CLAIMED_SCOPE: ${targetScope}\n`);

    // Now scan and show dead items
    console.log("🔍 Scanning for dead code...\n");
    const deadItems = scanScope(targetScope);

    if (deadItems.length === 0) {
      console.log("✨ No dead code found in this scope!\n");

      // Mark scope as complete
      const trackerData = readTracker();
      trackerData.scopes[targetScope] = {
        scannedAt: new Date().toISOString(),
        status: "complete",
        deadCount: 0,
        removedCount: 0,
        deferredCount: 0,
      };
      writeTracker(trackerData);
    } else {
      console.log(`Found ${deadItems.length} potentially dead item(s):\n`);

      for (let i = 0; i < deadItems.length; i++) {
        const item = deadItems[i];
        const confidenceIcon =
          item.confidence >= 0.9 ? "🔴" : item.confidence >= 0.7 ? "🟠" : "🟡";

        console.log(`${i + 1}. ${confidenceIcon} ${item.path}`);
        console.log(`   ├── Confidence: ${Math.round(item.confidence * 100)}%`);
        console.log(`   ├── Lines: ${item.lines}`);
        console.log(`   ├── Last modified: ${item.lastModified}`);
        if (item.exports.length > 0) {
          console.log(`   └── Exports: ${item.exports.slice(0, 5).join(", ")}${item.exports.length > 5 ? "..." : ""}`);
        } else {
          console.log(`   └── Exports: (none)`);
        }
        console.log("");
      }

      console.log("─────────────────────────────────────────");
      console.log("Review each item and decide:");
      console.log("  • DELETE - Remove the file");
      console.log("  • DEFER  - Keep for now, mark for later");
      console.log("  • FALSE POSITIVE - Mark so it won't appear again");
      console.log("");
    }

    releaseLock();
  } catch (err) {
    console.error("❌ Error during auto-claim:", err.message);
    releaseLock();
    process.exit(1);
  }
}

function markFalsePositive(filePath) {
  const tracker = readTracker();
  const normalized = filePath.replace(/\\/g, "/").replace(/^src\//, "");

  if (!tracker.falsePositives) {
    tracker.falsePositives = [];
  }

  if (tracker.falsePositives.includes(normalized)) {
    console.log(`\n⚠️  Already marked as false positive: ${normalized}\n`);
    return;
  }

  tracker.falsePositives.push(normalized);

  // Also update items if present
  if (tracker.items[normalized]) {
    tracker.items[normalized].status = "false-positive";
    tracker.items[normalized].resolvedAt = new Date().toISOString();
  }

  writeTracker(tracker);
  console.log(`\n✅ Marked as false positive: ${normalized}\n`);
}

function showStats() {
  const tracker = readTracker();
  const scopes = discoverScopes();

  let completedScopes = 0;
  let totalDead = 0;
  let totalRemoved = 0;
  let totalDeferred = 0;
  let totalFalsePositives = tracker.falsePositives?.length || 0;

  for (const scope of scopes) {
    const scopeData = tracker.scopes?.[scope];
    if (scopeData?.status === "complete") {
      completedScopes++;
      totalDead += scopeData.deadCount || 0;
      totalRemoved += scopeData.removedCount || 0;
      totalDeferred += scopeData.deferredCount || 0;
    }
  }

  console.log("\n📊 Dead Code Statistics\n");
  console.log("─────────────────────────────────────");
  console.log(`Scopes scanned:     ${completedScopes} / ${scopes.length}`);
  console.log(`Dead items found:   ${totalDead}`);
  console.log(`Items removed:      ${totalRemoved}`);
  console.log(`Items deferred:     ${totalDeferred}`);
  console.log(`False positives:    ${totalFalsePositives}`);
  if (tracker.stats?.lastScan) {
    console.log(`Last scan:          ${tracker.stats.lastScan}`);
  }
  console.log("─────────────────────────────────────\n");
}

function showDefault() {
  console.log("\n🔍 Dead Code Detection\n");
  console.log("Usage:");
  console.log("  node scripts/find-deadcode.cjs --auto-claim     Claim next scope and scan");
  console.log("  node scripts/find-deadcode.cjs --list           List all scopes");
  console.log("  node scripts/find-deadcode.cjs --claims         Show active claims");
  console.log("  node scripts/find-deadcode.cjs --stats          Show statistics");
  console.log("  node scripts/find-deadcode.cjs --claim <scope>  Claim specific scope");
  console.log("  node scripts/find-deadcode.cjs --release <scope> Release a claim");
  console.log("  node scripts/find-deadcode.cjs --false-positive <path> Mark false positive");
  console.log("  node scripts/find-deadcode.cjs --clear-expired  Clear expired claims");
  console.log("");

  // Quick preview
  const scopes = discoverScopes();
  const tracker = readTracker();
  const claims = readClaims();

  let pending = 0;
  let complete = 0;
  let claimed = 0;

  for (const scope of scopes) {
    const scopeData = tracker.scopes?.[scope];
    const claim = claims.claims?.[scope];
    const isClaimed = claim && !isExpired(claim);

    if (isClaimed) claimed++;
    else if (scopeData?.status === "complete") complete++;
    else pending++;
  }

  console.log(`📁 Scopes: ${scopes.length} total (${complete} done, ${claimed} claimed, ${pending} pending)`);
  console.log(`\nRun --auto-claim to start working on the next scope.\n`);
}

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);

if (args.includes("--list")) {
  listScopes();
} else if (args.includes("--claims")) {
  showClaims();
} else if (args.includes("--clear-expired")) {
  clearExpiredClaims();
} else if (args.includes("--stats")) {
  showStats();
} else if (args.includes("--auto-claim")) {
  autoClaimScope();
} else if (args.includes("--claim")) {
  const idx = args.indexOf("--claim");
  const scope = args[idx + 1];
  if (!scope) {
    console.error("\n❌ Usage: --claim <scope>\n");
    process.exit(1);
  }
  claimScope(scope);
} else if (args.includes("--release")) {
  const idx = args.indexOf("--release");
  const scope = args[idx + 1];
  if (!scope) {
    console.error("\n❌ Usage: --release <scope>\n");
    process.exit(1);
  }
  releaseScope(scope);
} else if (args.includes("--false-positive")) {
  const idx = args.indexOf("--false-positive");
  const filePath = args[idx + 1];
  if (!filePath) {
    console.error("\n❌ Usage: --false-positive <file-path>\n");
    process.exit(1);
  }
  markFalsePositive(filePath);
} else {
  showDefault();
}
