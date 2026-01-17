#!/usr/bin/env node
/**
 * Automated fix script for hardcoded CSS durations
 *
 * Replaces hardcoded duration values with CSS custom properties.
 * Only touches CSS contexts (style blocks, .css files).
 *
 * Usage:
 *   node scripts/fix-durations.cjs [--dry-run] [--file path]
 *
 * Options:
 *   --dry-run    Show what would be changed without modifying files
 *   --file       Fix a single file instead of all
 *   --verbose    Show each replacement
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Files/folders to exclude
const EXCLUDE_PATTERNS = [
  "node_modules",
  ".svelte-kit",
  "build",
  "dist",
  ".git",
  "app.css", // Variables defined here
  "transitions.ts", // Constants defined here
  "keyframes.css", // Already uses variables
  "fix-durations.cjs", // This script
  "audit-durations.cjs",
];

// Duration mappings - hardcoded value to CSS variable
// Only include values that map cleanly to our tier system
const DURATION_REPLACEMENTS = [
  // Instant tier (100ms)
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "100ms", replacement: "var(--duration-instant)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.1s", replacement: "var(--duration-instant)" },

  // Fast tier (150ms)
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "150ms", replacement: "var(--duration-fast)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.15s", replacement: "var(--duration-fast)" },

  // Normal tier (200ms)
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "200ms", replacement: "var(--duration-normal)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.2s", replacement: "var(--duration-normal)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "250ms", replacement: "var(--duration-normal)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.25s", replacement: "var(--duration-normal)" },

  // Emphasis tier (280ms)
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "280ms", replacement: "var(--duration-emphasis)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.28s", replacement: "var(--duration-emphasis)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "300ms", replacement: "var(--duration-emphasis)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.3s", replacement: "var(--duration-emphasis)" },

  // Dramatic tier (350ms)
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "350ms", replacement: "var(--duration-dramatic)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.35s", replacement: "var(--duration-dramatic)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "400ms", replacement: "var(--duration-dramatic)" },
  { pattern: /(\d*\.?\d+)(ms|s)/g, match: "0.4s", replacement: "var(--duration-dramatic)" },
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose");
const fileArgIndex = args.indexOf("--file");
const singleFile = fileArgIndex !== -1 ? args[fileArgIndex + 1] : null;

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

function findFilesToFix() {
  if (singleFile) {
    return [singleFile];
  }

  const results = [];

  try {
    const grepResult = execSync(
      `grep -r -l -E "transition[^;]*[0-9]+(ms|s)|animation[^;]*[0-9]+(ms|s)" --include="*.svelte" --include="*.css" src/`,
      { encoding: "utf-8", cwd: process.cwd() }
    );

    const files = grepResult
      .trim()
      .split("\n")
      .filter((f) => f && !shouldExclude(f));
    results.push(...files);
  } catch (e) {
    // grep returns non-zero if no matches
  }

  return [...new Set(results)];
}

function extractStyleSection(content) {
  // For .svelte files, only process the <style> section
  // For .css files, process the whole file
  const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    return {
      before: content.slice(0, styleMatch.index + styleMatch[0].indexOf(">") + 1),
      style: styleMatch[1],
      after: content.slice(styleMatch.index + styleMatch[0].length - 8), // "</style>" onwards
      isComponent: true,
    };
  }
  return {
    before: "",
    style: content,
    after: "",
    isComponent: false,
  };
}

function fixDurationsInCSS(css) {
  let result = css;
  const replacements = [];

  // Process each line to handle transition/animation properties
  const lines = result.split("\n");
  const fixedLines = lines.map((line, lineNum) => {
    // Skip lines that already use CSS variables
    if (line.includes("var(--duration")) return line;

    // Skip lines in @keyframes (animation-duration inside keyframes doesn't make sense)
    // Skip comments
    if (line.trim().startsWith("/*") || line.trim().startsWith("*") || line.trim().startsWith("//")) {
      return line;
    }

    // Only process lines with transition or animation properties
    if (!/(transition|animation)/.test(line)) return line;

    let fixedLine = line;

    for (const { match, replacement } of DURATION_REPLACEMENTS) {
      // Create a pattern that matches the duration value in context
      // Must be preceded by : or space (not part of another number)
      // Must be followed by space, comma, semicolon, or end
      const contextPattern = new RegExp(
        `([:,\\s])${match.replace(".", "\\.")}([\\s,;)])`,
        "g"
      );

      if (contextPattern.test(fixedLine)) {
        const before = fixedLine;
        fixedLine = fixedLine.replace(contextPattern, `$1${replacement}$2`);
        if (before !== fixedLine) {
          replacements.push({
            line: lineNum + 1,
            from: match,
            to: replacement,
          });
        }
      }
    }

    return fixedLine;
  });

  return {
    css: fixedLines.join("\n"),
    replacements,
  };
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const isCssFile = filePath.endsWith(".css");
  const isSvelteFile = filePath.endsWith(".svelte");

  if (!isCssFile && !isSvelteFile) {
    return { skipped: true, reason: "not a CSS or Svelte file" };
  }

  const { before, style, after, isComponent } = extractStyleSection(content);

  if (!style.trim()) {
    return { skipped: true, reason: "no style content" };
  }

  const { css: fixedCSS, replacements } = fixDurationsInCSS(style);

  if (replacements.length === 0) {
    return { skipped: true, reason: "no replacements needed" };
  }

  const newContent = isComponent ? before + fixedCSS + after : fixedCSS;

  if (dryRun) {
    return {
      fixed: true,
      replacements,
      count: replacements.length,
    };
  }

  fs.writeFileSync(filePath, newContent, "utf-8");
  return {
    fixed: true,
    replacements,
    count: replacements.length,
  };
}

function main() {
  console.log(
    dryRun
      ? "DRY RUN - showing what would be changed\n"
      : "Standardizing CSS durations...\n"
  );

  const files = findFilesToFix();
  let totalReplacements = 0;
  let fixedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const filePath of files) {
    try {
      const result = fixFile(filePath);

      if (result.skipped) {
        skippedCount++;
        if (verbose) {
          console.log(`SKIP: ${filePath} (${result.reason})`);
        }
      } else if (result.fixed) {
        fixedCount++;
        totalReplacements += result.count;
        console.log(
          `${dryRun ? "WOULD FIX" : "FIXED"}: ${filePath} (${result.count} replacements)`
        );
        if (verbose) {
          for (const r of result.replacements) {
            console.log(`  Line ${r.line}: ${r.from} → ${r.to}`);
          }
        }
      }
    } catch (error) {
      errors.push({ filePath, error: error.message });
      console.error(`ERROR: ${filePath} - ${error.message}`);
    }
  }

  console.log("\n=====================================");
  console.log(`Files processed: ${files.length}`);
  console.log(`${dryRun ? "Would fix" : "Fixed"}: ${fixedCount} files`);
  console.log(`${dryRun ? "Would replace" : "Replaced"}: ${totalReplacements} durations`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errors.length}`);

  if (!dryRun && fixedCount > 0) {
    console.log("\nRun `npm run check` to verify no issues.");
  }
}

main();
