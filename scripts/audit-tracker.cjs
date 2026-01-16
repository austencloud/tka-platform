#!/usr/bin/env node

/**
 * Audit Tracker Script
 *
 * Tracks audit history for modules, tabs, and features.
 * Helps identify what needs auditing next based on:
 * - Never audited
 * - Low grades (priority for re-audit)
 * - Stale audits (audited long ago)
 *
 * Usage:
 *   node scripts/audit-tracker.cjs                    # Show audit queue (what needs attention)
 *   node scripts/audit-tracker.cjs list               # List all audited targets with grades
 *   node scripts/audit-tracker.cjs targets            # List all auditable targets
 *   node scripts/audit-tracker.cjs status <target>    # Show detailed status for a target
 *   node scripts/audit-tracker.cjs record <target>    # Record audit results interactively
 *   node scripts/audit-tracker.cjs record <target> --grades "A,A+,A,B,A,A,A,A+" --notes "..."
 *   node scripts/audit-tracker.cjs claim <target>     # Claim a target for auditing
 *   node scripts/audit-tracker.cjs release <target>   # Release a claim
 *   node scripts/audit-tracker.cjs add-target <path> <type> <name>  # Add auditable target
 *   node scripts/audit-tracker.cjs stats              # Show overall audit coverage stats
 */

const fs = require("fs");
const path = require("path");

// Configuration
const AUDIT_FILE = path.join(__dirname, "..", ".audit-tracker.json");
const SRC_DIR = path.join(__dirname, "..", "src", "lib", "features");
const SHARED_DIR = path.join(__dirname, "..", "src", "lib", "shared");

// Stale threshold: audits older than this are flagged for re-audit
const STALE_DAYS = 30;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

// Claim expiry: 4 hours
const CLAIM_EXPIRY_MS = 4 * 60 * 60 * 1000;

// Grade definitions and scoring
const GRADE_ORDER = ["A+", "A", "B", "C", "F"];
const GRADE_SCORES = { "A+": 5, A: 4, B: 3, C: 2, F: 1 };

// The 8 audit dimensions
const DIMENSIONS = [
  { key: "architecture", name: "Architecture" },
  { key: "codeQuality", name: "Code Quality" },
  { key: "svelte5", name: "Svelte 5" },
  { key: "accessibility", name: "Accessibility" },
  { key: "uxStates", name: "UX States" },
  { key: "uiConsistency", name: "UI Consistency" },
  { key: "performance", name: "Performance" },
  { key: "security", name: "Security" },
];

/**
 * Read audit data from file
 */
function readAuditData() {
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Warning: Could not read audit file:", err.message);
  }
  return { audits: {}, targets: [], claims: {} };
}

/**
 * Write audit data to file
 */
function writeAuditData(data) {
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing audit file:", err.message);
    return false;
  }
}

/**
 * Auto-discover auditable targets from the codebase
 */
function discoverTargets() {
  const targets = [];

  // Discover feature modules
  if (fs.existsSync(SRC_DIR)) {
    const modules = fs.readdirSync(SRC_DIR).filter((f) => {
      const stat = fs.statSync(path.join(SRC_DIR, f));
      return stat.isDirectory();
    });

    for (const mod of modules) {
      const modPath = path.join(SRC_DIR, mod);
      targets.push({
        path: `features/${mod}`,
        type: "module",
        name: formatName(mod),
        fsPath: modPath,
      });

      // Look for tabs within the module
      const tabsDir = path.join(modPath, "tabs");
      if (fs.existsSync(tabsDir)) {
        const tabs = fs.readdirSync(tabsDir).filter((f) => {
          const stat = fs.statSync(path.join(tabsDir, f));
          return stat.isDirectory();
        });
        for (const tab of tabs) {
          targets.push({
            path: `features/${mod}/tabs/${tab}`,
            type: "tab",
            name: `${formatName(mod)} > ${formatName(tab)}`,
            parent: `features/${mod}`,
            fsPath: path.join(tabsDir, tab),
          });
        }
      }

      // Look for components directory
      const componentsDir = path.join(modPath, "components");
      if (fs.existsSync(componentsDir)) {
        targets.push({
          path: `features/${mod}/components`,
          type: "components",
          name: `${formatName(mod)} Components`,
          parent: `features/${mod}`,
          fsPath: componentsDir,
        });
      }
    }
  }

  // Discover shared modules
  if (fs.existsSync(SHARED_DIR)) {
    const shared = fs.readdirSync(SHARED_DIR).filter((f) => {
      const stat = fs.statSync(path.join(SHARED_DIR, f));
      return stat.isDirectory();
    });

    for (const mod of shared) {
      targets.push({
        path: `shared/${mod}`,
        type: "shared",
        name: `Shared: ${formatName(mod)}`,
        fsPath: path.join(SHARED_DIR, mod),
      });
    }
  }

  return targets;
}

/**
 * Format a directory name as a readable name
 */
function formatName(dirName) {
  return dirName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Calculate overall grade from dimension grades
 */
function calculateOverallGrade(grades) {
  const scores = Object.values(grades).map((g) => GRADE_SCORES[g] || 0);
  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avg >= 4.8) return "A+";
  if (avg >= 4.0) return "A";
  if (avg >= 3.0) return "B";
  if (avg >= 2.0) return "C";
  return "F";
}

/**
 * Calculate priority score for a target (higher = needs audit more)
 */
function calculatePriority(target, audit, claim) {
  let priority = 0;

  // Never audited = highest base priority
  if (!audit) {
    priority = 100;
    return priority;
  }

  // Currently claimed = skip
  if (claim && !isClaimExpired(claim)) {
    return -1;
  }

  // Low grades increase priority
  const overallGrade = audit.overallGrade || calculateOverallGrade(audit.grades);
  if (overallGrade === "F") priority += 80;
  else if (overallGrade === "C") priority += 60;
  else if (overallGrade === "B") priority += 40;
  else if (overallGrade === "A") priority += 20;
  // A+ = no boost

  // Stale audits increase priority
  const auditDate = new Date(audit.lastAuditedAt);
  const ageMs = Date.now() - auditDate.getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (ageDays > STALE_DAYS) {
    priority += Math.min(40, Math.floor((ageDays - STALE_DAYS) / 7) * 5);
  }

  // Has unresolved issues
  if (audit.issues && audit.issues.length > 0) {
    const unresolved = audit.issues.filter((i) => !i.resolved);
    priority += unresolved.length * 5;
  }

  return priority;
}

/**
 * Check if a claim is expired
 */
function isClaimExpired(claim) {
  if (!claim) return true;
  const claimedAt = new Date(claim.claimedAt).getTime();
  return Date.now() - claimedAt > CLAIM_EXPIRY_MS;
}

/**
 * Show audit queue (what needs attention)
 */
function showQueue() {
  const data = readAuditData();
  const allTargets = discoverTargets();

  // Calculate priorities for all targets
  const prioritized = allTargets
    .map((target) => ({
      target,
      audit: data.audits[target.path],
      claim: data.claims[target.path],
      priority: calculatePriority(
        target,
        data.audits[target.path],
        data.claims[target.path]
      ),
    }))
    .filter((p) => p.priority >= 0) // Exclude claimed
    .sort((a, b) => b.priority - a.priority);

  const neverAudited = prioritized.filter((p) => !p.audit);
  const needsReaudit = prioritized.filter(
    (p) => p.audit && p.priority > 0
  );
  const healthy = prioritized.filter((p) => p.audit && p.priority === 0);

  console.log("\n" + "=".repeat(80));
  console.log("\n  📊 AUDIT QUEUE\n");
  console.log("─".repeat(80));

  // Never audited (highest priority)
  if (neverAudited.length > 0) {
    console.log(`\n  🆕 NEVER AUDITED (${neverAudited.length}):\n`);
    neverAudited.slice(0, 10).forEach((item, idx) => {
      console.log(
        `     ${(idx + 1).toString().padStart(2)}. [${item.target.type.padEnd(10)}] ${item.target.name}`
      );
    });
    if (neverAudited.length > 10) {
      console.log(`     ... and ${neverAudited.length - 10} more`);
    }
  }

  // Needs re-audit
  if (needsReaudit.length > 0) {
    console.log(`\n  🔄 NEEDS RE-AUDIT (${needsReaudit.length}):\n`);
    needsReaudit.slice(0, 10).forEach((item, idx) => {
      const grade = item.audit.overallGrade || "?";
      const gradeIcon =
        grade === "A+" ? "🌟" : grade === "A" ? "✅" : grade === "B" ? "🟡" : grade === "C" ? "🟠" : "🔴";
      const age = Math.floor(
        (Date.now() - new Date(item.audit.lastAuditedAt).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      console.log(
        `     ${(idx + 1).toString().padStart(2)}. ${gradeIcon} ${grade.padEnd(2)} │ ${age.toString().padStart(3)}d │ ${item.target.name}`
      );
    });
    if (needsReaudit.length > 10) {
      console.log(`     ... and ${needsReaudit.length - 10} more`);
    }
  }

  // Summary
  console.log("\n" + "─".repeat(80));
  console.log(`\n  📈 COVERAGE SUMMARY:`);
  console.log(`     Total targets:   ${allTargets.length}`);
  console.log(`     Never audited:   ${neverAudited.length}`);
  console.log(`     Needs re-audit:  ${needsReaudit.length}`);
  console.log(`     Healthy (A/A+):  ${healthy.length}`);

  // Top recommendation
  if (prioritized.length > 0 && prioritized[0].priority > 0) {
    const top = prioritized[0];
    console.log("\n  🎯 TOP RECOMMENDATION:");
    console.log(`     ${top.target.name}`);
    console.log(`     Path: src/lib/${top.target.path}`);
    if (top.audit) {
      console.log(`     Last audit: ${top.audit.lastAuditedAt.split("T")[0]}`);
      console.log(`     Grade: ${top.audit.overallGrade || "Unknown"}`);
    } else {
      console.log("     Status: Never audited");
    }
    console.log(
      `\n     Run: node scripts/audit-tracker.cjs claim "${top.target.path}"`
    );
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

/**
 * List all audited targets
 */
function listAudits() {
  const data = readAuditData();

  console.log("\n" + "=".repeat(80));
  console.log("\n  📋 AUDIT HISTORY\n");
  console.log("─".repeat(80));

  const audits = Object.entries(data.audits).sort((a, b) => {
    const dateA = new Date(a[1].lastAuditedAt);
    const dateB = new Date(b[1].lastAuditedAt);
    return dateB - dateA; // Most recent first
  });

  if (audits.length === 0) {
    console.log("\n  No audits recorded yet.\n");
    console.log("  Run: node scripts/audit-tracker.cjs record <target>\n");
  } else {
    console.log(
      "\n  Grade │ Date       │ Target"
    );
    console.log("  " + "─".repeat(70));

    audits.forEach(([targetPath, audit]) => {
      const grade = audit.overallGrade || "?";
      const gradeIcon =
        grade === "A+"
          ? "🌟"
          : grade === "A"
            ? "✅"
            : grade === "B"
              ? "🟡"
              : grade === "C"
                ? "🟠"
                : "🔴";
      const date = audit.lastAuditedAt.split("T")[0];
      const name = audit.name || targetPath;

      console.log(`  ${gradeIcon} ${grade.padEnd(2)} │ ${date} │ ${name}`);
    });
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

/**
 * List all auditable targets
 */
function listTargets() {
  const allTargets = discoverTargets();
  const data = readAuditData();

  console.log("\n" + "=".repeat(80));
  console.log("\n  🎯 AUDITABLE TARGETS\n");
  console.log("─".repeat(80));

  // Group by type
  const byType = {};
  allTargets.forEach((t) => {
    if (!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t);
  });

  Object.entries(byType).forEach(([type, targets]) => {
    console.log(`\n  📁 ${type.toUpperCase()} (${targets.length}):\n`);
    targets.forEach((t) => {
      const audit = data.audits[t.path];
      const status = audit
        ? `${audit.overallGrade || "?"} (${audit.lastAuditedAt.split("T")[0]})`
        : "Not audited";
      console.log(`     ${t.path.padEnd(45)} │ ${status}`);
    });
  });

  console.log("\n" + "=".repeat(80) + "\n");
}

/**
 * Show detailed status for a target
 */
function showStatus(targetPath) {
  const data = readAuditData();
  const allTargets = discoverTargets();

  const target = allTargets.find((t) => t.path === targetPath);
  if (!target) {
    console.log(`\n  ❌ Target not found: ${targetPath}`);
    console.log("  Run: node scripts/audit-tracker.cjs targets\n");
    return;
  }

  const audit = data.audits[targetPath];
  const claim = data.claims[targetPath];

  console.log("\n" + "=".repeat(80));
  console.log(`\n  📊 AUDIT STATUS: ${target.name}\n`);
  console.log("─".repeat(80));
  console.log(`  Path: src/lib/${target.path}`);
  console.log(`  Type: ${target.type}`);

  if (claim && !isClaimExpired(claim)) {
    console.log(`\n  🔒 CLAIMED`);
    console.log(`     Claimed at: ${claim.claimedAt}`);
    console.log(`     By: ${claim.agentId}`);
  }

  if (!audit) {
    console.log("\n  ⚠️  Never audited");
    console.log(
      `\n  Run: node scripts/audit-tracker.cjs record "${targetPath}"`
    );
  } else {
    console.log(`\n  📅 Last audited: ${audit.lastAuditedAt}`);
    console.log(`  🏆 Overall grade: ${audit.overallGrade || "Unknown"}`);

    console.log("\n  📊 DIMENSION GRADES:\n");
    DIMENSIONS.forEach((dim) => {
      const grade = audit.grades[dim.key] || "?";
      const gradeIcon =
        grade === "A+"
          ? "🌟"
          : grade === "A"
            ? "✅"
            : grade === "B"
              ? "🟡"
              : grade === "C"
                ? "🟠"
                : grade === "F"
                  ? "🔴"
                  : "❓";
      console.log(`     ${gradeIcon} ${dim.name.padEnd(15)} │ ${grade}`);
    });

    if (audit.notes) {
      console.log("\n  📝 NOTES:");
      console.log(`     ${audit.notes}`);
    }

    if (audit.issues && audit.issues.length > 0) {
      console.log(`\n  🐛 ISSUES (${audit.issues.length}):`);
      audit.issues.forEach((issue, idx) => {
        const icon = issue.resolved ? "✅" : "⚠️";
        console.log(`     ${icon} ${idx + 1}. ${issue.description}`);
      });
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

/**
 * Record audit results
 */
function recordAudit(targetPath, gradesStr, notes) {
  const data = readAuditData();
  const allTargets = discoverTargets();

  const target = allTargets.find((t) => t.path === targetPath);
  if (!target) {
    console.log(`\n  ❌ Target not found: ${targetPath}`);
    console.log("  Run: node scripts/audit-tracker.cjs targets\n");
    return;
  }

  // Parse grades if provided
  let grades = {};
  if (gradesStr) {
    const gradeValues = gradesStr.split(",").map((g) => g.trim());
    if (gradeValues.length !== DIMENSIONS.length) {
      console.log(
        `\n  ❌ Expected ${DIMENSIONS.length} grades, got ${gradeValues.length}`
      );
      console.log(
        `  Order: ${DIMENSIONS.map((d) => d.name).join(", ")}`
      );
      console.log('  Example: --grades "A+,A,A,B,A,A,A+,A"\n');
      return;
    }
    DIMENSIONS.forEach((dim, idx) => {
      const grade = gradeValues[idx].toUpperCase();
      if (!GRADE_ORDER.includes(grade)) {
        console.log(`\n  ❌ Invalid grade "${gradeValues[idx]}" for ${dim.name}`);
        console.log(`  Valid grades: ${GRADE_ORDER.join(", ")}\n`);
        return;
      }
      grades[dim.key] = grade;
    });
  } else {
    // Interactive mode - prompt for each grade
    console.log("\n" + "=".repeat(80));
    console.log(`\n  📊 RECORDING AUDIT: ${target.name}\n`);
    console.log("─".repeat(80));
    console.log("  Enter grades (A+, A, B, C, F) for each dimension:\n");

    // For non-interactive use, provide instructions
    console.log("  ⚠️  Interactive mode not available in script context.");
    console.log("  Use --grades flag to provide all grades at once:\n");
    console.log(
      `  node scripts/audit-tracker.cjs record "${targetPath}" --grades "A+,A,A,B,A,A,A+,A"`
    );
    console.log(`\n  Dimensions in order:`);
    DIMENSIONS.forEach((dim, idx) => {
      console.log(`     ${idx + 1}. ${dim.name}`);
    });
    console.log("\n" + "=".repeat(80) + "\n");
    return;
  }

  // Calculate overall grade
  const overallGrade = calculateOverallGrade(grades);

  // Create audit record
  const audit = {
    lastAuditedAt: new Date().toISOString(),
    name: target.name,
    type: target.type,
    grades,
    overallGrade,
    notes: notes || null,
    issues: [],
  };

  // Preserve existing issues if updating
  if (data.audits[targetPath]?.issues) {
    audit.issues = data.audits[targetPath].issues;
  }

  data.audits[targetPath] = audit;

  // Release any claim
  if (data.claims[targetPath]) {
    delete data.claims[targetPath];
  }

  if (writeAuditData(data)) {
    console.log("\n" + "=".repeat(80));
    console.log(`\n  ✅ AUDIT RECORDED\n`);
    console.log("─".repeat(80));
    console.log(`  Target: ${target.name}`);
    console.log(`  Path: src/lib/${target.path}`);
    console.log(`  Overall Grade: ${overallGrade}`);
    console.log("\n  Dimension Grades:");
    DIMENSIONS.forEach((dim) => {
      const grade = grades[dim.key];
      const gradeIcon =
        grade === "A+"
          ? "🌟"
          : grade === "A"
            ? "✅"
            : grade === "B"
              ? "🟡"
              : grade === "C"
                ? "🟠"
                : "🔴";
      console.log(`     ${gradeIcon} ${dim.name.padEnd(15)} │ ${grade}`);
    });
    console.log("\n" + "=".repeat(80) + "\n");
  }
}

/**
 * Claim a target for auditing (with atomic locking)
 */
function claimTarget(targetPath) {
  const allTargets = discoverTargets();

  const target = allTargets.find((t) => t.path === targetPath);
  if (!target) {
    console.log(`\n  ❌ Target not found: ${targetPath}`);
    console.log("  Run: node scripts/audit-tracker.cjs targets\n");
    return;
  }

  // Use a lock file for atomic claims
  const lockFile = AUDIT_FILE + ".lock";
  const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Try to acquire lock (atomic via O_EXCL)
  let lockFd;
  try {
    lockFd = fs.openSync(lockFile, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
    fs.writeSync(lockFd, agentId);
    fs.closeSync(lockFd);
  } catch (err) {
    if (err.code === "EEXIST") {
      // Lock exists - check if stale (> 30 seconds)
      try {
        const lockStat = fs.statSync(lockFile);
        const lockAge = Date.now() - lockStat.mtimeMs;
        if (lockAge > 30000) {
          // Stale lock, remove and retry
          fs.unlinkSync(lockFile);
          return claimTarget(targetPath);
        }
      } catch {}
      console.log(`\n  ⚠️  Another agent is claiming right now. Try again in a moment.\n`);
      return;
    }
    throw err;
  }

  try {
    // Now we have the lock - read, check, and write atomically
    const data = readAuditData();

    // Check for existing claim
    if (data.claims[targetPath] && !isClaimExpired(data.claims[targetPath])) {
      console.log(`\n  ⚠️  Target already claimed:`);
      console.log(`     Claimed at: ${data.claims[targetPath].claimedAt}`);
      console.log(`     By: ${data.claims[targetPath].agentId}`);
      console.log("     Use 'release' command to free this claim.\n");
      return;
    }

    data.claims[targetPath] = {
      claimedAt: new Date().toISOString(),
      agentId,
    };

    if (writeAuditData(data)) {
      console.log("\n" + "=".repeat(80));
      console.log(`\n  🔒 CLAIMED FOR AUDIT\n`);
      console.log("─".repeat(80));
      console.log(`  Target: ${target.name}`);
      console.log(`  Path: src/lib/${target.path}`);
      console.log(`  Type: ${target.type}`);
      console.log(`  Agent: ${agentId}`);
      console.log(
        `\n  📝 CLAIMED_TARGET: ${targetPath}`
      );
      console.log(
        `\n  After auditing, run:`
      );
      console.log(
        `     node scripts/audit-tracker.cjs record "${targetPath}" --grades "..."`
      );
      console.log("\n" + "=".repeat(80) + "\n");
    }
  } finally {
    // Always release the lock
    try {
      fs.unlinkSync(lockFile);
    } catch {}
  }
}

/**
 * Release a claim
 */
function releaseClaim(targetPath) {
  const data = readAuditData();

  if (!data.claims[targetPath]) {
    console.log(`\n  ⚠️  No claim found for: ${targetPath}\n`);
    return;
  }

  delete data.claims[targetPath];

  if (writeAuditData(data)) {
    console.log(`\n  ✅ Released claim: ${targetPath}\n`);
  }
}

/**
 * Show audit coverage stats
 */
function showStats() {
  const data = readAuditData();
  const allTargets = discoverTargets();

  const audited = Object.keys(data.audits).length;
  const total = allTargets.length;
  const coverage = ((audited / total) * 100).toFixed(1);

  // Grade distribution
  const gradeCount = { "A+": 0, A: 0, B: 0, C: 0, F: 0 };
  Object.values(data.audits).forEach((audit) => {
    const grade = audit.overallGrade || "F";
    if (gradeCount.hasOwnProperty(grade)) {
      gradeCount[grade]++;
    }
  });

  // Stale audits
  const stale = Object.values(data.audits).filter((audit) => {
    const age = Date.now() - new Date(audit.lastAuditedAt).getTime();
    return age > STALE_MS;
  }).length;

  console.log("\n" + "=".repeat(80));
  console.log("\n  📊 AUDIT COVERAGE STATISTICS\n");
  console.log("─".repeat(80));

  console.log(`\n  📈 COVERAGE:`);
  console.log(`     Total targets:     ${total}`);
  console.log(`     Audited:           ${audited}`);
  console.log(`     Not audited:       ${total - audited}`);
  console.log(`     Coverage:          ${coverage}%`);

  console.log(`\n  🏆 GRADE DISTRIBUTION:`);
  console.log(`     🌟 A+:  ${gradeCount["A+"].toString().padStart(3)}`);
  console.log(`     ✅ A:   ${gradeCount["A"].toString().padStart(3)}`);
  console.log(`     🟡 B:   ${gradeCount["B"].toString().padStart(3)}`);
  console.log(`     🟠 C:   ${gradeCount["C"].toString().padStart(3)}`);
  console.log(`     🔴 F:   ${gradeCount["F"].toString().padStart(3)}`);

  if (stale > 0) {
    console.log(`\n  ⏰ STALE (>${STALE_DAYS} days): ${stale}`);
  }

  // Type breakdown
  const byType = {};
  allTargets.forEach((t) => {
    if (!byType[t.type]) byType[t.type] = { total: 0, audited: 0 };
    byType[t.type].total++;
    if (data.audits[t.path]) byType[t.type].audited++;
  });

  console.log(`\n  📁 BY TYPE:`);
  Object.entries(byType).forEach(([type, counts]) => {
    const pct = ((counts.audited / counts.total) * 100).toFixed(0);
    console.log(
      `     ${type.padEnd(12)} ${counts.audited}/${counts.total} (${pct}%)`
    );
  });

  console.log("\n" + "=".repeat(80) + "\n");
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                           AUDIT TRACKER                                      ║
╚══════════════════════════════════════════════════════════════════════════════╝

QUEUE & STATUS
──────────────────────────────────────────────────────────────────────────────
  (no args)              Show audit queue (what needs attention next)
  list                   List all recorded audits with grades
  targets                List all auditable targets
  status <target>        Show detailed audit status for a target
  stats                  Show overall coverage statistics

AUDITING
──────────────────────────────────────────────────────────────────────────────
  claim <target>         Claim a target before auditing
  release <target>       Release a claim
  record <target> --grades "A+,A,A,B,A,A,A+,A" [--notes "..."]
                         Record audit results

GRADE ORDER (for --grades flag):
  1. Architecture
  2. Code Quality
  3. Svelte 5
  4. Accessibility
  5. UX States
  6. UI Consistency
  7. Performance
  8. Security

EXAMPLES
──────────────────────────────────────────────────────────────────────────────
  node scripts/audit-tracker.cjs                          # See what needs auditing
  node scripts/audit-tracker.cjs claim features/compose   # Claim before auditing
  node scripts/audit-tracker.cjs status features/compose  # Check status
  node scripts/audit-tracker.cjs record features/compose --grades "A+,A,A,B,A,A,A+,A"
`);
}

// Parse arguments and run
const args = process.argv.slice(2);

function main() {
  if (args.length === 0) {
    showQueue();
  } else if (args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    showHelp();
  } else if (args[0] === "list") {
    listAudits();
  } else if (args[0] === "targets") {
    listTargets();
  } else if (args[0] === "stats") {
    showStats();
  } else if (args[0] === "status") {
    if (!args[1]) {
      console.log("\n  Usage: node scripts/audit-tracker.cjs status <target>\n");
      return;
    }
    showStatus(args[1]);
  } else if (args[0] === "claim") {
    if (!args[1]) {
      console.log("\n  Usage: node scripts/audit-tracker.cjs claim <target>\n");
      return;
    }
    claimTarget(args[1]);
  } else if (args[0] === "release") {
    if (!args[1]) {
      console.log("\n  Usage: node scripts/audit-tracker.cjs release <target>\n");
      return;
    }
    releaseClaim(args[1]);
  } else if (args[0] === "record") {
    if (!args[1]) {
      console.log(
        '\n  Usage: node scripts/audit-tracker.cjs record <target> --grades "A+,A,A,B,A,A,A+,A"\n'
      );
      return;
    }
    const target = args[1];
    const gradesIdx = args.indexOf("--grades");
    const notesIdx = args.indexOf("--notes");
    const grades = gradesIdx !== -1 ? args[gradesIdx + 1] : null;
    const notes = notesIdx !== -1 ? args[notesIdx + 1] : null;
    recordAudit(target, grades, notes);
  } else {
    // Assume it's a target path for status
    showStatus(args[0]);
  }
}

main();
