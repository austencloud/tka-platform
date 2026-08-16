#!/usr/bin/env node
/**
 * Audit script for hardcoded animation/transition durations
 *
 * Finds files with hardcoded duration values (100ms, 200ms, 0.3s, etc.)
 * that should use CSS variables or DURATION constants.
 *
 * Usage:
 *   node scripts/audit-durations.cjs [--verbose] [--json]
 *
 * Options:
 *   --verbose   Show each occurrence with context
 *   --json      Output as JSON for programmatic use
 *   --summary   Only show summary counts
 */

const fs = require("fs");
const path = require("path");

// Files/folders to exclude
const EXCLUDE_PATTERNS = [
  "node_modules",
  ".svelte-kit",
  "build",
  "dist",
  ".git",
  "app.css", // CSS variables are defined here
  "transitions.ts", // DURATION constants are defined here
  "keyframes.css", // Uses variables
];

// Duration values and their recommended replacements
const DURATION_MAPPING = {
  // In milliseconds
  "50ms": {
    css: "var(--duration-instant)",
    js: "DURATION.instant",
    note: "Very short, consider if needed",
  },
  "75ms": {
    css: "var(--duration-instant)",
    js: "DURATION.instant",
    note: "Round to instant",
  },
  "100ms": {
    css: "var(--duration-instant)",
    js: "DURATION.instant",
    note: "Micro-feedback",
  },
  "120ms": {
    css: "var(--duration-fast)",
    js: "DURATION.fast",
    note: "Round to fast",
  },
  "150ms": {
    css: "var(--duration-fast)",
    js: "DURATION.fast",
    note: "Quick UI responses",
  },
  "180ms": {
    css: "var(--duration-normal)",
    js: "DURATION.normal",
    note: "Round to normal",
  },
  "200ms": {
    css: "var(--duration-normal)",
    js: "DURATION.normal",
    note: "Standard transitions",
  },
  "250ms": {
    css: "var(--duration-normal)",
    js: "DURATION.normal",
    note: "Round to normal",
  },
  "280ms": {
    css: "var(--duration-emphasis)",
    js: "DURATION.emphasis",
    note: "Emphasized changes",
  },
  "300ms": {
    css: "var(--duration-emphasis)",
    js: "DURATION.emphasis",
    note: "Round to emphasis",
  },
  "350ms": {
    css: "var(--duration-dramatic)",
    js: "DURATION.dramatic",
    note: "Major transitions",
  },
  "400ms": {
    css: "var(--duration-dramatic)",
    js: "DURATION.dramatic",
    note: "Round to dramatic",
  },
  "500ms": {
    css: "var(--duration-dramatic)",
    js: "DURATION.dramatic",
    note: "Very slow, consider reducing",
  },
  // In seconds
  "0.05s": {
    css: "var(--duration-instant)",
    js: "DURATION.instant",
    note: "Very short",
  },
  "0.1s": {
    css: "var(--duration-instant)",
    js: "DURATION.instant",
    note: "Micro-feedback",
  },
  "0.15s": {
    css: "var(--duration-fast)",
    js: "DURATION.fast",
    note: "Quick UI responses",
  },
  "0.2s": {
    css: "var(--duration-normal)",
    js: "DURATION.normal",
    note: "Standard transitions",
  },
  "0.25s": {
    css: "var(--duration-normal)",
    js: "DURATION.normal",
    note: "Round to normal",
  },
  "0.28s": {
    css: "var(--duration-emphasis)",
    js: "DURATION.emphasis",
    note: "Emphasized changes",
  },
  "0.3s": {
    css: "var(--duration-emphasis)",
    js: "DURATION.emphasis",
    note: "Round to emphasis",
  },
  "0.35s": {
    css: "var(--duration-dramatic)",
    js: "DURATION.dramatic",
    note: "Major transitions",
  },
  "0.4s": {
    css: "var(--duration-dramatic)",
    js: "DURATION.dramatic",
    note: "Very slow",
  },
  "0.5s": {
    css: "var(--duration-dramatic)",
    js: "DURATION.dramatic",
    note: "Very slow, consider reducing",
  },
};

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const jsonOutput = args.includes("--json");
const summaryOnly = args.includes("--summary");
const scopeIdx = args.indexOf("--scope");
const scopePath = scopeIdx !== -1 ? args[scopeIdx + 1] : null;
const searchDir = scopePath ? `src/lib/${scopePath}` : "src/";

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

function findFilesWithDurations() {
  const results = [];
  const root = path.resolve(process.cwd(), searchDir);
  const candidatePattern =
    /(duration|transition|animation)[^;]*[0-9]+(?:ms|s)[^a-z]/i;

  function visit(directory) {
    if (!fs.existsSync(directory) || shouldExclude(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!/\.(?:svelte|css|ts)$/.test(entry.name)) continue;
      const relativePath = path.relative(process.cwd(), absolutePath);
      if (shouldExclude(relativePath)) continue;
      if (candidatePattern.test(fs.readFileSync(absolutePath, "utf-8"))) {
        results.push(relativePath);
      }
    }
  }

  visit(root);
  return results;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const occurrences = [];

  // Pattern to find duration values in animation/transition contexts
  const durationPattern =
    /(?:duration|transition|animation)[^;{]*?(\d+(?:\.\d+)?)(ms|s)/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;

    while ((match = durationPattern.exec(line)) !== null) {
      const value = match[1];
      const unit = match[2];
      const fullValue = value + unit;

      // Skip if already using CSS variable
      if (line.includes("var(--duration")) continue;
      if (line.includes("DURATION.")) continue;

      // Skip very long durations (likely intentional, e.g., for looping animations)
      const msValue = unit === "s" ? parseFloat(value) * 1000 : parseInt(value);
      if (msValue > 1000) continue;

      const mapping = DURATION_MAPPING[fullValue] || {
        css: `var(--duration-*)`,
        js: "DURATION.*",
        note: "Choose appropriate tier",
      };

      occurrences.push({
        line: i + 1,
        value: fullValue,
        context: line.trim().substring(0, 100),
        replacement: mapping,
        msValue,
      });
    }
  }

  return {
    filePath,
    occurrences,
    count: occurrences.length,
  };
}

function main() {
  if (!jsonOutput) {
    console.log("Auditing hardcoded animation/transition durations...\n");
  }

  const files = findFilesWithDurations();
  const analyses = files.map(analyzeFile).filter((a) => a.count > 0);

  // Count by duration value
  const durationCounts = {};
  let totalOccurrences = 0;

  for (const analysis of analyses) {
    for (const occ of analysis.occurrences) {
      durationCounts[occ.value] = (durationCounts[occ.value] || 0) + 1;
      totalOccurrences++;
    }
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          totalFiles: analyses.length,
          totalOccurrences,
          byDuration: durationCounts,
          files: analyses.map((a) => ({
            path: a.filePath,
            count: a.count,
            occurrences: verbose ? a.occurrences : undefined,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  console.log("HARDCODED DURATION SUMMARY:");
  console.log("===========================\n");

  // Sort by count
  const sortedDurations = Object.entries(durationCounts).sort(
    (a, b) => b[1] - a[1]
  );

  for (const [duration, count] of sortedDurations) {
    const mapping = DURATION_MAPPING[duration] || {
      css: "?",
      js: "?",
      note: "",
    };
    console.log(`  ${duration}: ${count} occurrences`);
    console.log(`    -> CSS: ${mapping.css}`);
    console.log(`    -> JS:  ${mapping.js}`);
    if (mapping.note) console.log(`    Note: ${mapping.note}`);
    console.log();
  }

  if (!summaryOnly) {
    console.log("\nFILES WITH HARDCODED DURATIONS:");
    console.log("================================\n");

    // Sort by count descending
    const sortedAnalyses = analyses.sort((a, b) => b.count - a.count);

    for (const analysis of sortedAnalyses.slice(0, verbose ? undefined : 20)) {
      console.log(`${analysis.filePath} (${analysis.count} occurrences)`);
      if (verbose) {
        for (const occ of analysis.occurrences) {
          console.log(`  Line ${occ.line}: ${occ.value}`);
          console.log(`    ${occ.context}`);
          console.log(`    -> ${occ.replacement.css} / ${occ.replacement.js}`);
        }
      }
    }

    if (!verbose && sortedAnalyses.length > 20) {
      console.log(`\n... and ${sortedAnalyses.length - 20} more files`);
    }
  }

  console.log("\n=====================================");
  console.log(`Files with hardcoded durations: ${analyses.length}`);
  console.log(`Total occurrences: ${totalOccurrences}`);

  console.log("\n\nRECOMMENDED APPROACH:");
  console.log("=====================");
  console.log(`
In CSS (scoped styles):
  Instead of: transition: opacity 200ms ease;
  Use:        transition: opacity var(--duration-normal) ease;

In JavaScript (Svelte transitions):
  Instead of: <div in:fade={{ duration: 200 }}>
  Use:        <div in:fadeStandard>
  Or:         <div in:fade={{ duration: DURATION.normal }}>

Duration Tiers:
  --duration-instant (100ms) - Micro-feedback, toggles
  --duration-fast (150ms)    - Quick UI responses
  --duration-normal (200ms)  - Standard transitions
  --duration-emphasis (280ms)- Emphasized changes
  --duration-dramatic (350ms)- Major transitions, modals
`);
}

main();
