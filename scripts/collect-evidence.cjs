#!/usr/bin/env node

/**
 * Deterministic Evidence Collector for Audit Pipeline
 *
 * Scans source files using fs + RegExp (no LLM) and produces structured JSON
 * with per-dimension findings. Each finding includes file, line, and preview.
 *
 * Usage:
 *   node scripts/collect-evidence.cjs <scope> [--out <path>]
 *
 * Examples:
 *   node scripts/collect-evidence.cjs "features/compose"
 *   node scripts/collect-evidence.cjs "features/compose" --out .audit-evidence.json
 *   node scripts/collect-evidence.cjs "shared/pictograph" --out evidence.json
 *
 * Output: JSON to stdout (or file if --out specified) with per-dimension findings.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const scope = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const outPath = outIdx !== -1 ? args[outIdx + 1] : null;

if (!scope) {
  console.error("Usage: node scripts/collect-evidence.cjs <scope> [--out <path>]");
  console.error('Example: node scripts/collect-evidence.cjs "features/compose"');
  process.exit(1);
}

const SRC_ROOT = path.join(__dirname, "..", "src", "lib");
const scopeDir = path.join(SRC_ROOT, scope);

if (!fs.existsSync(scopeDir)) {
  console.error(`Scope directory not found: ${scopeDir}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function collectFiles(dir, extensions) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules" || entry.name === ".svelte-kit") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(full, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch {
    // directory not accessible
  }
  return results;
}

const allFiles = collectFiles(scopeDir, [".svelte", ".ts"]);
const svelteFiles = allFiles.filter((f) => f.endsWith(".svelte"));
const tsFiles = allFiles.filter((f) => f.endsWith(".ts"));
const cssFiles = collectFiles(scopeDir, [".css"]);
const allWithCss = [...allFiles, ...cssFiles];
const svelteAndCss = [...svelteFiles, ...cssFiles];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return path relative to src/lib/ for display */
function rel(absPath) {
  return path.relative(SRC_ROOT, absPath).replace(/\\/g, "/");
}

/** Scan a file's lines against a regex, returning findings */
function scanFile(filePath, regex, { skipInComment = false } = {}) {
  const findings = [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (skipInComment && /^\s*\/\//.test(line)) continue;
      if (regex.test(line)) {
        findings.push({
          file: rel(filePath),
          line: i + 1,
          preview: line.trim().substring(0, 120),
        });
      }
      // Reset lastIndex for global regexes
      regex.lastIndex = 0;
    }
  } catch {
    // file not readable
  }
  return findings;
}

/** Scan all files in a list against a regex */
function scanAll(files, regex, options) {
  const results = [];
  for (const f of files) {
    results.push(...scanFile(f, regex, options));
  }
  return results;
}

/** Check if a file contains a pattern (boolean) */
function fileContains(filePath, regex) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return regex.test(content);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shell out to existing audit scripts (with --scope support)
// ---------------------------------------------------------------------------

function runExternalAudit(scriptName, scopePath) {
  try {
    const result = execSync(
      `node scripts/${scriptName} --json --scope "${scopePath}"`,
      {
        encoding: "utf-8",
        cwd: path.join(__dirname, ".."),
        timeout: 30000,
      }
    );
    return JSON.parse(result);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dimension: Architecture
// ---------------------------------------------------------------------------

function collectArchitecture() {
  const findings = {};

  // Barrel imports: from './index' or from '.' or from '../something/index'
  findings.barrelImports = scanAll(
    allFiles,
    /from\s+['"][^'"]*\/index['"]/
  );

  // "Service" suffix in class names
  findings.serviceSuffix = scanAll(
    tsFiles,
    /class\s+\w+Service\s/
  );

  // utils/ or hooks/ directories
  findings.utilsOrHooks = [];
  for (const f of allFiles) {
    const relPath = rel(f);
    if (/\/(utils|hooks)\//.test(relPath)) {
      findings.utilsOrHooks.push({
        file: relPath,
        line: 0,
        preview: `File in ${relPath.includes("/utils/") ? "utils" : "hooks"} directory (should be a DI service)`,
      });
    }
  }

  // Missing DI: classes not registered in containers
  // Heuristic: .ts files with class exports that aren't in a contracts/ dir
  // Cross-references container files to eliminate false positives
  findings.potentialDiGaps = [];

  // Read all DI container files once for cross-referencing
  const containersDir = path.join(SRC_ROOT, "shared", "di", "containers");
  let containerContents = "";
  try {
    const containerFiles = fs.readdirSync(containersDir).filter((f) => f.endsWith(".ts"));
    containerContents = containerFiles
      .map((f) => fs.readFileSync(path.join(containersDir, f), "utf-8"))
      .join("\n");
  } catch {
    // containers dir not found — flag everything as before
  }

  for (const f of tsFiles) {
    const relPath = rel(f);
    if (relPath.includes("/contracts/")) continue;
    if (relPath.includes("/implementations/")) {
      try {
        const content = fs.readFileSync(f, "utf-8");
        const classMatch = content.match(/export\s+class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          // Skip if the class name appears in any container file (imported or instantiated)
          if (containerContents && containerContents.includes(className)) continue;
          findings.potentialDiGaps.push({
            file: relPath,
            line: 0,
            preview: `Class "${className}" in implementations/ - verify DI registration`,
          });
        }
      } catch {
        // skip
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Code Quality
// ---------------------------------------------------------------------------

function collectCodeQuality() {
  const findings = {};

  // `: any` type annotations
  findings.anyType = scanAll(allFiles, /:\s*any\b/, { skipInComment: true });

  // `as any` type assertions
  findings.asAny = scanAll(allFiles, /as\s+any\b/, { skipInComment: true });

  // `as unknown as` double assertions
  findings.asUnknownAs = scanAll(allFiles, /as\s+unknown\s+as\b/, { skipInComment: true });

  // Missing return types on exported functions (heuristic)
  findings.missingReturnType = scanAll(
    tsFiles,
    /export\s+(async\s+)?function\s+\w+\([^)]*\)\s*\{/,
    { skipInComment: true }
  );

  // "Service" suffix in imports (naming convention violation)
  findings.serviceNaming = scanAll(
    allFiles,
    /import.*Service['";\s}]/,
    { skipInComment: true }
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Accessibility
// ---------------------------------------------------------------------------

function collectAccessibility() {
  const findings = {};

  // Run scoped reduced-motion audit
  const motionResult = runExternalAudit("audit-reduced-motion.cjs", scope);
  findings.reducedMotion = motionResult
    ? (motionResult.files || []).map((f) => ({
        file: f.path,
        line: 0,
        preview: `Missing prefers-reduced-motion: keyframes [${(f.keyframes || []).join(", ")}]`,
      }))
    : [];

  // Font sizes below 12px in CSS
  findings.smallFontSize = scanAll(
    svelteAndCss,
    /font-size\s*:\s*(([0-9]|1[01])(\.\d+)?px|0\.\d+rem)/
  );

  // {@html} usage (potential XSS + a11y risk)
  findings.htmlDirective = scanAll(svelteFiles, /\{@html\b/);

  // div/span with onclick but no role
  findings.clickWithoutRole = [];
  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/on:click|onclick/.test(line) && /<(div|span)\b/.test(line) && !/role=/.test(line)) {
          findings.clickWithoutRole.push({
            file: rel(f),
            line: i + 1,
            preview: line.trim().substring(0, 120),
          });
        }
      }
    } catch {
      // skip
    }
  }

  // Missing aria-label on interactive elements
  findings.missingAriaLabel = [];
  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<button\b/.test(line) && !/aria-label/.test(line) && !/>.*<\/button>/.test(line)) {
          // Check subsequent lines until closing > for aria-label on a different line
          let hasAriaOnNextLines = false;
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            if (/aria-label/.test(lines[j])) {
              hasAriaOnNextLines = true;
              break;
            }
            // Stop looking if we hit a line that closes the opening tag
            // (line is just ">" or "/>" optionally with whitespace)
            if (/^\s*\/?>$/.test(lines[j].trim())) break;
          }
          if (!hasAriaOnNextLines) {
            findings.missingAriaLabel.push({
              file: rel(f),
              line: i + 1,
              preview: line.trim().substring(0, 120),
            });
          }
        }
      }
    } catch {
      // skip
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: UX States
// ---------------------------------------------------------------------------

function collectUxStates() {
  const findings = {};

  // Presence of loading state handling
  findings.hasLoadingState = false;
  findings.hasErrorState = false;
  findings.hasEmptyState = false;

  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      if (/\{#if.*loading/i.test(content) || /isLoading|is_loading/i.test(content)) {
        findings.hasLoadingState = true;
      }
      if (/\{#if.*error/i.test(content) || /isError|hasError/i.test(content)) {
        findings.hasErrorState = true;
      }
      if (/\{#if.*empty/i.test(content) || /\.length\s*===?\s*0/i.test(content) || /no\s*(items|results|data)/i.test(content)) {
        findings.hasEmptyState = true;
      }
    } catch {
      // skip
    }
  }

  // Bare catch blocks (swallowing errors)
  findings.bareCatch = scanAll(
    allFiles,
    /catch\s*\([^)]*\)\s*\{\s*\}/
  );

  // Also find catch(() => {}) pattern
  const bareCatchArrow = scanAll(
    allFiles,
    /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/
  );
  findings.bareCatch.push(...bareCatchArrow);

  // console.error without user feedback
  findings.consoleErrorOnly = scanAll(
    allFiles,
    /console\.error\(/,
    { skipInComment: true }
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: UI Consistency
// ---------------------------------------------------------------------------

function collectUiConsistency() {
  const findings = {};

  // Run scoped duration audit
  const durationResult = runExternalAudit("audit-durations.cjs", scope);
  findings.hardcodedDurations = durationResult
    ? {
        count: durationResult.totalOccurrences || 0,
        files: (durationResult.files || []).map((f) => ({
          file: f.path,
          line: 0,
          preview: `${f.count} hardcoded duration(s)`,
        })),
      }
    : { count: 0, files: [] };

  // Hardcoded colors: #hex or rgba() not inside var()
  findings.hardcodedColors = [];
  for (const f of svelteAndCss) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      let inStyle = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<style/.test(line)) inStyle = true;
        if (/<\/style>/.test(line)) inStyle = false;

        // Only check inside <style> blocks or .css files
        if (!inStyle && !f.endsWith(".css")) continue;

        // Skip comments
        if (/^\s*\/[/*]/.test(line)) continue;

        // Skip lines with var() wrapping
        if (/var\(/.test(line)) continue;

        // Skip CSS variable definitions (--custom-prop: #fff)
        if (/^\s*--[\w-]+\s*:/.test(line)) continue;

        // Find hardcoded hex colors
        if (/#[0-9a-fA-F]{3,8}\b/.test(line)) {
          findings.hardcodedColors.push({
            file: rel(f),
            line: i + 1,
            preview: line.trim().substring(0, 120),
          });
        }

        // Find hardcoded rgba/rgb
        if (/rgba?\s*\(/.test(line)) {
          findings.hardcodedColors.push({
            file: rel(f),
            line: i + 1,
            preview: line.trim().substring(0, 120),
          });
        }
      }
    } catch {
      // skip
    }
  }

  // Blur on non-modal elements
  findings.blurOnContent = scanAll(
    svelteAndCss,
    /backdrop-filter\s*:\s*blur|filter\s*:\s*blur/
  );

  // Legacy --*-current CSS variables
  findings.legacyVars = scanAll(
    svelteAndCss,
    /var\(--[\w-]+-current/
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Performance
// ---------------------------------------------------------------------------

function collectPerformance() {
  const findings = {};

  // Run scoped transition audit
  const transitionResult = runExternalAudit("audit-transitions.cjs", scope);
  findings.directTransitionImports = transitionResult
    ? {
        count: transitionResult.total || 0,
        files: (transitionResult.files || []).map((f) => ({
          file: f.path,
          line: 0,
          preview: `Direct svelte/transition import: [${(f.transitions || []).join(", ")}]`,
        })),
      }
    : { count: 0, files: [] };

  // Barrel imports (also in architecture, but perf-relevant)
  findings.barrelImports = scanAll(
    allFiles,
    /from\s+['"][^'"]*\/index['"]/
  );

  // $effect without cleanup return
  findings.effectWithoutCleanup = [];
  for (const f of allFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      let inEffect = false;
      let effectStart = 0;
      let braceDepth = 0;
      let hasReturn = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/\$effect\s*\(/.test(line)) {
          inEffect = true;
          effectStart = i;
          braceDepth = 0;
          hasReturn = false;
        }

        if (inEffect) {
          braceDepth += (line.match(/\{/g) || []).length;
          braceDepth -= (line.match(/\}/g) || []).length;
          if (/return\s/.test(line)) hasReturn = true;

          if (braceDepth <= 0 && i > effectStart) {
            // Check if this effect sets up listeners/timers that need cleanup
            const effectBlock = lines.slice(effectStart, i + 1).join("\n");
            const needsCleanup =
              /addEventListener|setInterval|setTimeout|subscribe/.test(effectBlock);
            if (needsCleanup && !hasReturn) {
              findings.effectWithoutCleanup.push({
                file: rel(f),
                line: effectStart + 1,
                preview: lines[effectStart].trim().substring(0, 120),
              });
            }
            inEffect = false;
          }
        }
      }
    } catch {
      // skip
    }
  }

  // setInterval/setTimeout without cleanup in .svelte files
  findings.timerWithoutCleanup = scanAll(
    svelteFiles,
    /\b(setInterval|setTimeout)\s*\(/,
    { skipInComment: true }
  );

  return findings;
}

// ---------------------------------------------------------------------------
// Dimension: Security
// ---------------------------------------------------------------------------

function collectSecurity() {
  const findings = {};

  // {@html} with 3-line context
  findings.htmlDirective = [];
  for (const f of svelteFiles) {
    try {
      const content = fs.readFileSync(f, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/\{@html\b/.test(lines[i])) {
          const contextStart = Math.max(0, i - 1);
          const contextEnd = Math.min(lines.length - 1, i + 1);
          const context = lines
            .slice(contextStart, contextEnd + 1)
            .map((l) => l.trim())
            .join(" | ");
          findings.htmlDirective.push({
            file: rel(f),
            line: i + 1,
            preview: context.substring(0, 200),
          });
        }
      }
    } catch {
      // skip
    }
  }

  // eval() or new Function()
  findings.evalUsage = scanAll(allFiles, /\beval\s*\(|new\s+Function\s*\(/);

  // Hardcoded secret patterns
  findings.hardcodedSecrets = scanAll(
    allFiles,
    /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}/i,
    { skipInComment: true }
  );

  // innerHTML assignment
  findings.innerHTML = scanAll(allFiles, /\.innerHTML\s*=/);

  return findings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const startTime = Date.now();

  const evidence = {
    meta: {
      scope,
      scopePath: path.relative(path.join(__dirname, ".."), scopeDir).replace(/\\/g, "/"),
      collectedAt: new Date().toISOString(),
      fileCount: {
        total: allFiles.length,
        svelte: svelteFiles.length,
        ts: tsFiles.length,
        css: cssFiles.length,
      },
    },
    dimensions: {
      architecture: collectArchitecture(),
      codeQuality: collectCodeQuality(),
      accessibility: collectAccessibility(),
      uxStates: collectUxStates(),
      uiConsistency: collectUiConsistency(),
      performance: collectPerformance(),
      security: collectSecurity(),
    },
  };

  // Add summary counts per dimension
  evidence.summary = {};
  for (const [dim, data] of Object.entries(evidence.dimensions)) {
    const counts = {};
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        counts[key] = value.length;
      } else if (typeof value === "object" && value !== null && "count" in value) {
        counts[key] = value.count;
      } else if (typeof value === "boolean") {
        counts[key] = value;
      }
    }
    evidence.summary[dim] = counts;
  }

  evidence.meta.durationMs = Date.now() - startTime;

  const json = JSON.stringify(evidence, null, 2);

  if (outPath) {
    const resolvedOut = path.isAbsolute(outPath)
      ? outPath
      : path.join(process.cwd(), outPath);
    fs.writeFileSync(resolvedOut, json);
    console.log(`Evidence written to ${resolvedOut}`);
    console.log(`Scope: ${scope} (${allFiles.length} files scanned in ${evidence.meta.durationMs}ms)`);

    // Print quick summary
    console.log("\nQuick Summary:");
    for (const [dim, counts] of Object.entries(evidence.summary)) {
      const total = Object.values(counts).reduce((sum, v) => {
        if (typeof v === "number") return sum + v;
        return sum;
      }, 0);
      console.log(`  ${dim}: ${total} finding(s)`);
    }
  } else {
    process.stdout.write(json);
  }
}

main();
