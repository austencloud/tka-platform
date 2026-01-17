#!/usr/bin/env node
/**
 * Automated fix script for prefers-reduced-motion support
 *
 * Adds @media (prefers-reduced-motion: reduce) blocks to Svelte components
 * that have animations but lack reduced-motion support.
 *
 * Usage:
 *   node scripts/fix-reduced-motion.cjs [--dry-run] [--file path]
 *
 * Options:
 *   --dry-run    Show what would be changed without modifying files
 *   --file       Fix a single file instead of all
 *   --verbose    Show detailed output
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
  "keyframes.css",
  "app.css",
];

// Keyframe names from centralized file (these are already handled globally)
const CENTRALIZED_KEYFRAMES = [
  "spin",
  "spin-reverse",
  "pulse",
  "pulse-scale",
  "pulse-glow",
  "fadeIn",
  "fadeOut",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "scaleIn",
  "scaleOut",
  "popIn",
  "bounce",
  "shake",
  "shimmer",
  "gradientShift",
  "star-twinkle-animation",
  "aurora-animation",
  "bubble-rise",
  "module-slide-out-left",
  "module-slide-in-left",
  "module-slide-out-right",
  "module-slide-in-right",
  "tab-slide-out-left",
  "tab-slide-in-left",
  "tab-slide-out-right",
  "tab-slide-in-right",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const verbose = args.includes("--verbose");
const fileArgIndex = args.indexOf("--file");
const singleFile =
  fileArgIndex !== -1 ? args[fileArgIndex + 1] : null;

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

function findFilesNeedingFix() {
  if (singleFile) {
    return [singleFile];
  }

  const results = [];

  // Find all .svelte files with @keyframes or animation:
  try {
    const grepResult = execSync(
      `grep -r -l -E "@keyframes|animation\\s*:" --include="*.svelte" src/`,
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

function needsFix(content) {
  // Check if file has animations
  const hasKeyframes = /@keyframes\s+([a-zA-Z0-9_-]+)/.test(content);
  const hasAnimation = /animation\s*:/.test(content);

  if (!hasKeyframes && !hasAnimation) {
    return false;
  }

  // Check if it already has proper reduced-motion support
  const hasReducedMotion = content.includes("prefers-reduced-motion");
  if (hasReducedMotion) {
    // Check if it actually disables animations
    const reducedMotionSection = content.match(
      /@media[^{]*prefers-reduced-motion[^{]*reduce[^{]*\{[\s\S]*?\}\s*\}/g
    );
    if (reducedMotionSection) {
      const section = reducedMotionSection.join("");
      if (
        section.includes("animation: none") ||
        section.includes("animation-duration: 0") ||
        section.includes("animation-duration: 0.01ms")
      ) {
        return false; // Already properly handled
      }
    }
  }

  return true;
}

function extractKeyframeNames(content) {
  const matches = content.match(/@keyframes\s+([a-zA-Z0-9_-]+)/g) || [];
  return matches
    .map((m) => m.replace("@keyframes ", "").trim())
    .filter((name) => !CENTRALIZED_KEYFRAMES.includes(name));
}

function extractAnimatedClasses(content) {
  // Find classes that use animation: property
  const classes = new Set();

  // Match CSS class definitions with animation
  const classAnimationPattern =
    /\.([a-zA-Z0-9_-]+)\s*\{[^}]*animation\s*:[^}]+\}/g;
  let match;
  while ((match = classAnimationPattern.exec(content)) !== null) {
    classes.add(match[1]);
  }

  // Also look for elements with animation in pseudo-selectors
  const pseudoPattern =
    /\.([a-zA-Z0-9_-]+)(?:::?[a-z-]+)?\s*\{[^}]*animation\s*:[^}]+\}/g;
  while ((match = pseudoPattern.exec(content)) !== null) {
    classes.add(match[1]);
  }

  return [...classes];
}

function generateReducedMotionBlock(keyframeNames, animatedClasses) {
  const lines = [];
  lines.push("");
  lines.push(
    "  /* Accessibility: Respect user's motion preferences (WCAG AAA) */"
  );
  lines.push("  @media (prefers-reduced-motion: reduce) {");

  if (animatedClasses.length > 0) {
    // Add specific class overrides
    for (const className of animatedClasses) {
      lines.push(`    .${className} {`);
      lines.push("      animation: none;");
      lines.push("    }");
    }
  }

  // If we found local keyframes, add a general selector
  if (keyframeNames.length > 0) {
    lines.push("    /* Disable local keyframe animations */");
    for (const keyframeName of keyframeNames) {
      // Find elements that use this keyframe
      lines.push(`    [style*="${keyframeName}"] {`);
      lines.push("      animation: none;");
      lines.push("    }");
    }
  }

  // If no specific classes found, use a broad approach
  if (animatedClasses.length === 0 && keyframeNames.length === 0) {
    lines.push("    * {");
    lines.push("      animation-duration: 0.01ms !important;");
    lines.push("      animation-iteration-count: 1 !important;");
    lines.push("    }");
  }

  lines.push("  }");

  return lines.join("\n");
}

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");

  if (!needsFix(content)) {
    return { skipped: true, reason: "already has reduced-motion support" };
  }

  // Find the style section
  const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) {
    return { skipped: true, reason: "no <style> section found" };
  }

  const styleContent = styleMatch[1];
  const styleEndIndex = content.indexOf("</style>");

  // Extract information about animations
  const keyframeNames = extractKeyframeNames(styleContent);
  const animatedClasses = extractAnimatedClasses(styleContent);

  // Generate the reduced-motion block
  const reducedMotionBlock = generateReducedMotionBlock(
    keyframeNames,
    animatedClasses
  );

  // Insert before </style>
  const newContent =
    content.slice(0, styleEndIndex) +
    reducedMotionBlock +
    "\n" +
    content.slice(styleEndIndex);

  if (dryRun) {
    return {
      fixed: true,
      keyframeNames,
      animatedClasses,
      preview: reducedMotionBlock,
    };
  }

  fs.writeFileSync(filePath, newContent, "utf-8");
  return { fixed: true, keyframeNames, animatedClasses };
}

function main() {
  console.log(
    dryRun
      ? "DRY RUN - showing what would be changed\n"
      : "Fixing reduced-motion support...\n"
  );

  const files = findFilesNeedingFix();
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
        console.log(`${dryRun ? "WOULD FIX" : "FIXED"}: ${filePath}`);
        if (verbose) {
          console.log(`  Keyframes: ${result.keyframeNames.join(", ") || "none"}`);
          console.log(
            `  Animated classes: ${result.animatedClasses.join(", ") || "none"}`
          );
          if (dryRun && result.preview) {
            console.log("  Preview:");
            console.log(
              result.preview
                .split("\n")
                .map((l) => "    " + l)
                .join("\n")
            );
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
  console.log(`${dryRun ? "Would fix" : "Fixed"}: ${fixedCount}`);
  console.log(`Skipped (already OK): ${skippedCount}`);
  console.log(`Errors: ${errors.length}`);

  if (!dryRun && fixedCount > 0) {
    console.log("\nRun `npm run check` to verify no TypeScript errors.");
  }
}

main();
